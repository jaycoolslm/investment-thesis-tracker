import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  VALID_THESIS_FIXTURE,
  VALID_WEEKLY_LOG_FIXTURE,
} from "../../agent/__tests__/fixtures.js";

// Mock agent + market data to avoid real API calls
const mockGenerateThesis = vi.fn();
const mockAnalyseWeekly = vi.fn();
const mockGetWeeklyReturn = vi.fn();
const mockGetIndexWeeklyReturn = vi.fn();

vi.mock("../../agent/codex-agent.js", () => ({
  ThesisAgent: class MockThesisAgent {
    generateThesis = mockGenerateThesis;
    analyseWeekly = mockAnalyseWeekly;
  },
}));

vi.mock("../../services/market-data.js", () => ({
  MarketDataService: class MockMarketDataService {
    getWeeklyReturn = mockGetWeeklyReturn;
    getIndexWeeklyReturn = mockGetIndexWeeklyReturn;
  },
}));

// Dynamic imports after mocks
const { createApp } = await import("../../app.js");
const { db } = await import("../../db/index.js");
const { holdings, theses, weeklyLogs, documents } =
  await import("../../db/schema.js");
const { clearRegistry } = await import("../../services/batch-runner.js");
const { runMonitoringBatch } = await import("../../jobs/scheduler.js");
const { eq } = await import("drizzle-orm");

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
  mockGetWeeklyReturn.mockResolvedValue(null);
  mockGetIndexWeeklyReturn.mockResolvedValue(null);
  mockAnalyseWeekly.mockResolvedValue(WEEKLY_LOG_RESULT);
  await db.delete(documents);
  await db.delete(weeklyLogs);
  await db.delete(theses);
  await db.delete(holdings);
});

/** Create a holding + thesis via API (mocked agent) */
async function seedHoldingWithThesis(
  overrides: Partial<{
    ticker: string;
    companyName: string;
    direction: string;
    status: string;
  }> = {},
) {
  const { body: holding } = await request(app)
    .post("/api/holdings")
    .send({
      ticker: overrides.ticker ?? "AAPL",
      companyName: overrides.companyName ?? "Apple Inc.",
      direction: overrides.direction ?? "long",
    });

  mockGenerateThesis.mockResolvedValueOnce(VALID_THESIS_FIXTURE);
  await request(app)
    .post(`/api/holdings/${holding.id}/generate`)
    .send({ bullets: "Strong services growth" });

  // Set non-active status if requested
  if (overrides.status && overrides.status !== "active") {
    await request(app)
      .put(`/api/holdings/${holding.id}`)
      .send({ status: overrides.status });
  }

  return holding;
}

/** Run a full monitoring batch and return the tickers that got a weekly log. */
async function runBatchAndGetLoggedTickers(): Promise<{
  total: number;
  tickers: string[];
}> {
  const result = await runMonitoringBatch();
  if (!result) return { total: 0, tickers: [] };
  await result.done;

  const rows = await db
    .select({ ticker: holdings.ticker })
    .from(weeklyLogs)
    .innerJoin(holdings, eq(weeklyLogs.holdingId, holdings.id));

  return { total: result.total, tickers: rows.map((r) => r.ticker) };
}

describe("Paused/closed holding monitoring (integration)", () => {
  it("POST /holdings/:id/weekly-logs/trigger skips paused holding", async () => {
    const holding = await seedHoldingWithThesis({ status: "paused" });

    const res = await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    expect(mockAnalyseWeekly).not.toHaveBeenCalled();
  });

  it("POST /holdings/:id/weekly-logs/trigger skips closed holding", async () => {
    const holding = await seedHoldingWithThesis({ status: "closed" });

    const res = await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    expect(mockAnalyseWeekly).not.toHaveBeenCalled();
  });

  it("batch monitoring excludes paused holdings", async () => {
    await seedHoldingWithThesis({ ticker: "AAPL" });
    await seedHoldingWithThesis({ ticker: "MSFT", companyName: "Microsoft Corp." });
    await seedHoldingWithThesis({
      ticker: "TSLA",
      companyName: "Tesla Inc.",
      status: "paused",
    });

    const { total, tickers } = await runBatchAndGetLoggedTickers();

    expect(total).toBe(2);
    expect(tickers).toContain("AAPL");
    expect(tickers).toContain("MSFT");
    expect(tickers).not.toContain("TSLA");
  });

  it("batch monitoring excludes closed holdings", async () => {
    await seedHoldingWithThesis({ ticker: "AAPL" });
    await seedHoldingWithThesis({
      ticker: "GOOG",
      companyName: "Alphabet Inc.",
      status: "closed",
    });

    const { total, tickers } = await runBatchAndGetLoggedTickers();

    expect(total).toBe(1);
    expect(tickers).toEqual(["AAPL"]);
  });

  it("re-activating a paused holding includes it in next batch", async () => {
    const holding = await seedHoldingWithThesis({
      ticker: "NVDA",
      companyName: "NVIDIA Corp.",
      status: "paused",
    });

    // Re-activate
    await request(app)
      .put(`/api/holdings/${holding.id}`)
      .send({ status: "active" });

    const { total, tickers } = await runBatchAndGetLoggedTickers();

    expect(total).toBe(1);
    expect(tickers).toEqual(["NVDA"]);
  });

  it("pausing a holding mid-week preserves existing weekly log", async () => {
    const holding = await seedHoldingWithThesis();

    // Run monitoring first (creates a weekly log)
    const triggerRes = await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();
    expect(triggerRes.status).toBe(201);

    // Now pause the holding
    await request(app)
      .put(`/api/holdings/${holding.id}`)
      .send({ status: "paused" });

    // Verify the existing log is preserved
    const logsRes = await request(app).get(
      `/api/holdings/${holding.id}/weekly-logs`,
    );
    expect(logsRes.status).toBe(200);
    expect(logsRes.body).toHaveLength(1);
    expect(logsRes.body[0].holdingId).toBe(holding.id);

    // Re-trigger returns the existing log (idempotency check runs before status check)
    const retrigger = await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();
    expect(retrigger.status).toBe(201);
    expect(retrigger.body.id).toBe(triggerRes.body.id);
    expect(mockAnalyseWeekly).toHaveBeenCalledTimes(1); // only the first call
  });
});
