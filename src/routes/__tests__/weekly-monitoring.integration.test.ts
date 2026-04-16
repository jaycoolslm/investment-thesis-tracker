import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  VALID_THESIS_FIXTURE,
  VALID_WEEKLY_LOG_FIXTURE,
} from "../../agent/__tests__/fixtures.js";

// Mock the ThesisAgent and MarketDataService to avoid real API/Yahoo calls
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
const { holdings, theses, thesisPillars, weeklyLogs, documents } =
  await import("../../db/schema.js");

const app = createApp();

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(documents);
  await db.delete(weeklyLogs);
  await db.delete(thesisPillars);
  await db.delete(theses);
  await db.delete(holdings);
});

/** Helper: create a holding + thesis + pillars via API */
async function seedHoldingWithThesis() {
  const { body: holding } = await request(app)
    .post("/api/holdings")
    .send({ ticker: "AAPL", companyName: "Apple Inc.", direction: "long" });

  mockGenerateThesis.mockResolvedValueOnce(VALID_THESIS_FIXTURE);

  await request(app)
    .post(`/api/holdings/${holding.id}/generate`)
    .send({ bullets: "Strong services growth" });

  return holding;
}

describe("Weekly monitoring trigger (integration)", () => {
  it("POST /api/holdings/:id/weekly-logs/trigger creates a log entry", async () => {
    const holding = await seedHoldingWithThesis();

    mockGetWeeklyReturn.mockResolvedValueOnce({
      priceChangePct: 3.2,
      currentPrice: 232.5,
      previousPrice: 225.3,
      currency: "USD",
    });
    mockGetIndexWeeklyReturn.mockResolvedValueOnce({
      priceChangePct: 1.1,
      currentPrice: 5050,
      previousPrice: 4995,
      currency: "USD",
    });
    mockAnalyseWeekly.mockResolvedValueOnce(VALID_WEEKLY_LOG_FIXTURE);

    const res = await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();

    expect(res.status).toBe(201);
    expect(res.body.holdingId).toBe(holding.id);
    expect(res.body.thesisImpact).toBe("strengthened");
    // Price fields overwritten by MarketDataService values, not agent values
    expect(parseFloat(res.body.priceChangePct)).toBeCloseTo(3.2, 1);
    expect(parseFloat(res.body.indexChangePct)).toBeCloseTo(1.1, 1);
    expect(res.body.summary).toBeTruthy();
  });

  it("updates holding latestImpact after monitoring", async () => {
    const holding = await seedHoldingWithThesis();

    mockGetWeeklyReturn.mockResolvedValueOnce(null);
    mockGetIndexWeeklyReturn.mockResolvedValueOnce(null);
    mockAnalyseWeekly.mockResolvedValueOnce({
      ...VALID_WEEKLY_LOG_FIXTURE,
      priceChangePct: null,
      indexChangePct: null,
      relativePerf: null,
      thesisImpact: "weakened",
    });

    await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();

    const holdingRes = await request(app).get(
      `/api/holdings/${holding.id}`,
    );
    expect(holdingRes.body.latestImpact).toBe("weakened");
  });

  it("returns existing log on idempotent re-trigger (same week)", async () => {
    const holding = await seedHoldingWithThesis();

    mockGetWeeklyReturn.mockResolvedValue(null);
    mockGetIndexWeeklyReturn.mockResolvedValue(null);
    mockAnalyseWeekly.mockResolvedValue({
      ...VALID_WEEKLY_LOG_FIXTURE,
      priceChangePct: null,
      indexChangePct: null,
      relativePerf: null,
    });

    const first = await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();

    expect(first.status).toBe(201);

    // Second call same week — agent should NOT be called again
    vi.clearAllMocks();
    const second = await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();

    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(mockAnalyseWeekly).not.toHaveBeenCalled();
  });

  it("returns 409 when holding has no thesis", async () => {
    const { body: holding } = await request(app)
      .post("/api/holdings")
      .send({
        ticker: "TSLA",
        companyName: "Tesla Inc.",
        direction: "short",
      });

    const res = await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("No thesis");
  });

  it("returns 404 for non-existent holding", async () => {
    const res = await request(app)
      .post(
        "/api/holdings/00000000-0000-0000-0000-000000000000/weekly-logs/trigger",
      )
      .send();

    expect(res.status).toBe(404);
  });

  it("persists null price fields when market data unavailable", async () => {
    const holding = await seedHoldingWithThesis();

    mockGetWeeklyReturn.mockResolvedValueOnce(null);
    mockGetIndexWeeklyReturn.mockResolvedValueOnce(null);
    mockAnalyseWeekly.mockResolvedValueOnce({
      ...VALID_WEEKLY_LOG_FIXTURE,
      priceChangePct: null,
      indexChangePct: null,
      relativePerf: null,
    });

    const res = await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();

    expect(res.status).toBe(201);
    expect(res.body.priceChangePct).toBeNull();
    expect(res.body.indexChangePct).toBeNull();
    expect(res.body.relativePerf).toBeNull();
    expect(res.body.summary).toBeTruthy();
  });

  it("log appears in GET /api/holdings/:id/weekly-logs after trigger", async () => {
    const holding = await seedHoldingWithThesis();

    mockGetWeeklyReturn.mockResolvedValueOnce(null);
    mockGetIndexWeeklyReturn.mockResolvedValueOnce(null);
    mockAnalyseWeekly.mockResolvedValueOnce({
      ...VALID_WEEKLY_LOG_FIXTURE,
      priceChangePct: null,
      indexChangePct: null,
      relativePerf: null,
    });

    await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();

    const logsRes = await request(app).get(
      `/api/holdings/${holding.id}/weekly-logs`,
    );

    expect(logsRes.status).toBe(200);
    expect(logsRes.body).toHaveLength(1);
    expect(logsRes.body[0].holdingId).toBe(holding.id);
  });

  it("returns 500 when agent throws", async () => {
    const holding = await seedHoldingWithThesis();

    mockGetWeeklyReturn.mockResolvedValueOnce(null);
    mockGetIndexWeeklyReturn.mockResolvedValueOnce(null);
    mockAnalyseWeekly.mockRejectedValueOnce(new Error("LLM unavailable"));

    const res = await request(app)
      .post(`/api/holdings/${holding.id}/weekly-logs/trigger`)
      .send();

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Weekly monitoring failed");
  });
});
