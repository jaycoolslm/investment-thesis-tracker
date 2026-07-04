import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { VALID_THESIS_FIXTURE } from "../../agent/__tests__/fixtures.js";

// Mock the ThesisAgent to avoid real API calls
const mockGenerate = vi.fn();
vi.mock("../../agent/codex-agent.js", () => ({
  ThesisAgent: class MockThesisAgent {
    generateThesis = mockGenerate;
  },
}));

// In integration tests we let config.ts parse real env vars from Testcontainers.
// We do NOT mock config here — the global setup has set DATABASE_URL.

// Dynamic imports after mocks
const { createApp } = await import("../../app.js");
const { db } = await import("../../db/index.js");
const { holdings, theses } = await import("../../db/schema.js");

const app = createApp();

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(theses);
  await db.delete(holdings);
});

describe("Thesis generation (integration)", () => {
  it("POST /api/holdings/:id/generate persists markdown thesis", async () => {
    // Create a holding
    const { body: holding } = await request(app)
      .post("/api/holdings")
      .send({ ticker: "AAPL", companyName: "Apple Inc.", direction: "long" });

    mockGenerate.mockResolvedValueOnce(VALID_THESIS_FIXTURE);

    const res = await request(app)
      .post(`/api/holdings/${holding.id}/generate`)
      .send({ bullets: "Strong services growth" });

    expect(res.status).toBe(201);
    expect(res.body.thesisId).toBeDefined();

    // Verify thesis persisted
    const thesisRes = await request(app).get(
      `/api/holdings/${holding.id}/thesis`,
    );
    expect(thesisRes.status).toBe(200);
    expect(thesisRes.body.content).toBe(VALID_THESIS_FIXTURE.content);
    expect(thesisRes.body.sources).toHaveLength(
      VALID_THESIS_FIXTURE.sources.length,
    );

    // The polled generation status reflects completion
    const statusRes = await request(app).get(
      `/api/holdings/${holding.id}/generation-status`,
    );
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe("complete");
    expect(Array.isArray(statusRes.body.events)).toBe(true);
  });

  it("POST /api/holdings/:id/generate returns 404 for missing holding", async () => {
    const res = await request(app)
      .post("/api/holdings/00000000-0000-0000-0000-000000000000/generate")
      .send({ bullets: "Some bullets" });

    expect(res.status).toBe(404);
  });

  it("POST /api/holdings/:id/generate returns 400 with no bullets", async () => {
    const { body: holding } = await request(app)
      .post("/api/holdings")
      .send({ ticker: "AAPL", companyName: "Apple Inc.", direction: "long" });

    const res = await request(app)
      .post(`/api/holdings/${holding.id}/generate`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("POST /api/holdings/:id/generate returns 500 when agent throws", async () => {
    const { body: holding } = await request(app)
      .post("/api/holdings")
      .send({ ticker: "AAPL", companyName: "Apple Inc.", direction: "long" });

    mockGenerate.mockRejectedValueOnce(new Error("LLM unavailable"));

    const res = await request(app)
      .post(`/api/holdings/${holding.id}/generate`)
      .send({ bullets: "Some bullets" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Generation failed");
  });
});
