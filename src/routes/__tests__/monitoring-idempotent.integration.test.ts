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

// Mock queue/Redis for batch operations
const mockEnqueueMonitoringBatch = vi.fn();
let hsetnxCallCount = 0;
const batchStates = new Map<string, Record<string, string>>();

vi.mock("../../jobs/queue.js", () => ({
  enqueueMonitoringBatch: (...args: unknown[]) =>
    mockEnqueueMonitoringBatch(...args),
  getMonitoringBatchState: vi.fn(async (weekLabel: string) => {
    const raw = batchStates.get(`monitoring:batch:${weekLabel}`);
    if (!raw?.status) return null;
    return {
      total: parseInt(raw.total, 10),
      completed: parseInt(raw.completed, 10),
      failed: parseInt(raw.failed, 10),
      status: raw.status,
      startedAt: raw.startedAt,
    };
  }),
  redisConnection: {
    hsetnx: vi.fn(async (key: string, field: string, value: string) => {
      hsetnxCallCount++;
      if (!batchStates.has(key)) {
        batchStates.set(key, { [field]: value });
        return 1;
      }
      return 0; // Already exists
    }),
    multi: vi.fn(() => ({
      hset: vi.fn(function (this: unknown, key: string, data: Record<string, string>) {
        const existing = batchStates.get(key) ?? {};
        batchStates.set(key, { ...existing, ...data });
        return this;
      }),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
    del: vi.fn(async (key: string) => {
      batchStates.delete(key);
    }),
    hgetall: vi.fn(async (key: string) => batchStates.get(key) ?? {}),
  },
  monitoringQueue: {},
  bulkQueue: {},
}));

// Dynamic imports after mocks
const { createApp } = await import("../../app.js");
const { db } = await import("../../db/index.js");
const { holdings, theses, thesisPillars, weeklyLogs, documents } =
  await import("../../db/schema.js");

const app = createApp();

beforeEach(async () => {
  vi.clearAllMocks();
  hsetnxCallCount = 0;
  batchStates.clear();
  await db.delete(documents);
  await db.delete(weeklyLogs);
  await db.delete(thesisPillars);
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
  it("POST /api/monitoring/trigger returns 409 on second call within same week", async () => {
    await seedHoldingWithThesis();

    // First call succeeds
    const first = await request(app).post("/api/monitoring/trigger").send();
    expect(first.status).toBe(202);
    expect(first.body.total).toBe(1);

    // Second call returns 409
    const second = await request(app).post("/api/monitoring/trigger").send();
    expect(second.status).toBe(409);
    expect(second.body.error).toContain("Batch already exists");
  });

  it("GET /api/monitoring/status returns batch state after trigger", async () => {
    await seedHoldingWithThesis();
    await request(app).post("/api/monitoring/trigger").send();

    const res = await request(app).get("/api/monitoring/status");

    expect(res.status).toBe(200);
    expect(res.body.weekLabel).toBeDefined();
    expect(res.body.total).toBe(1);
    expect(res.body.status).toBe("active");
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
