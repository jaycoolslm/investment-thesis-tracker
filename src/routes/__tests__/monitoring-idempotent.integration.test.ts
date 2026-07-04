import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  VALID_THESIS_FIXTURE,
  VALID_WEEKLY_LOG_FIXTURE,
} from "../../agent/__tests__/fixtures.js";

// Mock agent + market data
const mockGenerateThesis = vi.fn();
const mockAnalyseWeekly = vi.fn();

vi.mock("../../agent/codex-agent.js", () => ({
  ThesisAgent: class MockThesisAgent {
    generateThesis = mockGenerateThesis;
    analyseWeekly = mockAnalyseWeekly;
  },
}));

vi.mock("../../services/market-data.js", () => ({
  MarketDataService: class MockMarketDataService {
    getWeeklyReturn = vi.fn().mockResolvedValue(null);
    getIndexWeeklyReturn = vi.fn().mockResolvedValue(null);
  },
}));

// Dynamic imports after mocks
const { createApp } = await import("../../app.js");
const { db } = await import("../../db/index.js");
const { holdings, theses, weeklyLogs, documents } =
  await import("../../db/schema.js");
const { and, eq } = await import("drizzle-orm");
const { clearRegistry } = await import("../../services/batch-runner.js");
const { runMonitoringBatch } = await import("../../jobs/scheduler.js");
const { getCurrentWeek } = await import("../../services/weekly-monitoring.js");

const app = createApp();

const WEEKLY_LOG_RESULT = {
  ...VALID_WEEKLY_LOG_FIXTURE,
  priceChangePct: null,
  indexChangePct: null,
  relativePerf: null,
};

beforeEach(async () => {
  vi.clearAllMocks();
  clearRegistry();
  mockAnalyseWeekly.mockResolvedValue(WEEKLY_LOG_RESULT);
  await db.delete(documents);
  await db.delete(weeklyLogs);
  await db.delete(theses);
  await db.delete(holdings);
});

async function seedHoldingWithThesis(ticker = "AAPL") {
  const { body: holding } = await request(app)
    .post("/api/holdings")
    .send({
      ticker,
      companyName: `${ticker} Inc.`,
      direction: "long",
    });

  mockGenerateThesis.mockResolvedValueOnce(VALID_THESIS_FIXTURE);
  await request(app)
    .post(`/api/holdings/${holding.id}/generate`)
    .send({ bullets: "Strong growth" });

  return holding;
}

describe("Idempotent batch re-run (integration)", () => {
  it("POST /api/monitoring/trigger returns 409 while a batch is running", async () => {
    await seedHoldingWithThesis();

    // Hold the batch open: the agent call blocks until we release it
    let release!: () => void;
    mockAnalyseWeekly.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(WEEKLY_LOG_RESULT);
        }),
    );

    const first = await request(app).post("/api/monitoring/trigger").send();
    expect(first.status).toBe(202);
    expect(first.body.total).toBe(1);

    // The batch worker starts asynchronously — wait until it reaches the agent
    // call so `release` is assigned and the batch is genuinely mid-flight.
    await vi.waitFor(() => expect(mockAnalyseWeekly).toHaveBeenCalled());

    const second = await request(app).post("/api/monitoring/trigger").send();
    expect(second.status).toBe(409);
    expect(second.body.error).toContain("already running");

    // Let the batch finish so it doesn't leak into other tests
    release();
    await vi.waitFor(async () => {
      const res = await request(app).get("/api/monitoring/status");
      expect(res.body.status).toBe("complete");
    });
  });

  it("re-trigger after completion reports nothing to do and does not duplicate weekly logs", async () => {
    const holding = await seedHoldingWithThesis();

    const first = await request(app).post("/api/monitoring/trigger").send();
    expect(first.status).toBe(202);

    await vi.waitFor(async () => {
      const res = await request(app).get("/api/monitoring/status");
      expect(res.body.status).toBe("complete");
    });

    const second = await request(app).post("/api/monitoring/trigger").send();
    expect(second.status).toBe(200);
    expect(second.body.message).toContain("Nothing to monitor");

    // Exactly one log per (holding, week)
    const { weekLabel } = getCurrentWeek();
    const logs = await db
      .select()
      .from(weeklyLogs)
      .where(
        and(
          eq(weeklyLogs.holdingId, holding.id),
          eq(weeklyLogs.weekLabel, weekLabel),
        ),
      );
    expect(logs).toHaveLength(1);
    expect(mockAnalyseWeekly).toHaveBeenCalledTimes(1);
  });

  it("re-trigger resumes only holdings without a log this week", async () => {
    const logged = await seedHoldingWithThesis("AAPL");
    await seedHoldingWithThesis("MSFT");

    // AAPL already has a log for this week (simulates a crashed batch)
    const { weekLabel, weekDate } = getCurrentWeek();
    await db.insert(weeklyLogs).values({
      holdingId: logged.id,
      weekLabel,
      weekDate,
      thesisImpact: "unchanged",
      summary: "Pre-existing log",
    });

    const result = await runMonitoringBatch();
    expect(result).not.toBeNull();
    expect(result!.total).toBe(1); // only MSFT
    await result!.done;

    const logs = await db.select().from(weeklyLogs);
    expect(logs).toHaveLength(2);
    expect(mockAnalyseWeekly).toHaveBeenCalledTimes(1);
  });

  it("GET /api/monitoring/status returns batch state after trigger", async () => {
    await seedHoldingWithThesis();
    await request(app).post("/api/monitoring/trigger").send();

    const res = await request(app).get("/api/monitoring/status");

    expect(res.status).toBe(200);
    expect(res.body.weekLabel).toBeDefined();
    expect(res.body.total).toBe(1);
    expect(["active", "complete"]).toContain(res.body.status);
  });

  it("GET /api/monitoring/status derives a summary from weekly_logs on a fresh process", async () => {
    const holding = await seedHoldingWithThesis();
    const result = await runMonitoringBatch();
    await result!.done;

    // Simulate a restart: registry gone, logs persist
    clearRegistry();

    const res = await request(app).get("/api/monitoring/status");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("complete");
    expect(res.body.total).toBe(1);
    expect(res.body.completed).toBe(1);
    expect(res.body.failed).toBe(0);
    expect(res.body.startedAt).toBeDefined();

    const logs = await db
      .select()
      .from(weeklyLogs)
      .where(eq(weeklyLogs.holdingId, holding.id));
    expect(logs).toHaveLength(1);
  });

  it("GET /api/monitoring/status returns 404 when no batch exists", async () => {
    const res = await request(app).get("/api/monitoring/status");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("No monitoring batch found");
  });

  it("GET /api/monitoring/history returns aggregated batch data from weekly_logs", async () => {
    const holding = await seedHoldingWithThesis();

    // Insert weekly logs directly for aggregation testing
    await db.insert(weeklyLogs).values([
      {
        holdingId: holding.id,
        weekLabel: "2026-W15",
        weekDate: "2026-04-06",
        thesisImpact: "strengthened",
        summary: "Strong week",
      },
      {
        holdingId: holding.id,
        weekLabel: "2026-W16",
        weekDate: "2026-04-13",
        thesisImpact: "weakened",
        summary: "Weak week",
      },
    ]);

    // Create a second holding with a log in W16 to test aggregation
    const { body: h2 } = await request(app)
      .post("/api/holdings")
      .send({ ticker: "MSFT", companyName: "Microsoft", direction: "long" });

    await db.insert(weeklyLogs).values({
      holdingId: h2.id,
      weekLabel: "2026-W16",
      weekDate: "2026-04-13",
      thesisImpact: "unchanged",
      summary: "Flat week",
    });

    const res = await request(app).get("/api/monitoring/history");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    // Most recent week first
    const w16 = res.body.find(
      (r: { weekLabel: string }) => r.weekLabel === "2026-W16",
    );
    expect(w16).toBeDefined();
    expect(w16.total).toBe(2);
    expect(w16.weakened).toBe(1);
    expect(w16.unchanged).toBe(1);
    expect(w16.strengthened).toBe(0);

    const w15 = res.body.find(
      (r: { weekLabel: string }) => r.weekLabel === "2026-W15",
    );
    expect(w15).toBeDefined();
    expect(w15.total).toBe(1);
    expect(w15.strengthened).toBe(1);
  });
});
