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

// Mock config
vi.mock("../../config.js", () => ({
  config: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    PORT: 3001,
    NODE_ENV: "test",
    OPENAI_API_KEY: "test-key",
  },
}));

// Mock drizzle DB
const mockSelect = vi.fn();
const mockInsert = vi.fn();

vi.mock("../../db/index.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockSelect,
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: mockInsert,
      }),
    }),
  },
}));

const { createApp } = await import("../../app.js");
const { clearProgressStore, getGenerationProgress } = await import(
  "../../services/progress-store.js"
);
const app = createApp();

describe("POST /api/holdings/:id/generate", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
    clearProgressStore();
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await request(app)
      .post("/api/holdings/not-a-uuid/generate")
      .send({ bullets: "test" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid holding ID");
  });

  it("returns 400 for missing bullets", async () => {
    const res = await request(app)
      .post(`/api/holdings/${validUuid}/generate`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("returns 400 for empty bullets", async () => {
    const res = await request(app)
      .post(`/api/holdings/${validUuid}/generate`)
      .send({ bullets: "" });

    expect(res.status).toBe(400);
  });

  it("returns 404 when holding does not exist", async () => {
    // Mock holding not found
    mockSelect.mockResolvedValueOnce([]);

    const res = await request(app)
      .post(`/api/holdings/${validUuid}/generate`)
      .send({ bullets: "Strong growth" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Holding not found");
  });

  it("returns 201 with thesisId on success", async () => {
    const holdingRow = {
      id: validUuid,
      ticker: "AAPL",
      companyName: "Apple Inc.",
      direction: "long",
      benchmark: "S&P 500",
      status: "active",
    };
    const thesisId = "660e8400-e29b-41d4-a716-446655440001";

    // Mock: holding exists
    mockSelect.mockResolvedValueOnce([holdingRow]);
    // Mock: no documents
    mockSelect.mockResolvedValueOnce([]);

    // Mock: agent returns valid thesis
    mockGenerate.mockResolvedValueOnce(VALID_THESIS_FIXTURE);

    // Mock: insert persists and returns the thesis row
    mockInsert.mockResolvedValueOnce([{ id: thesisId }]);

    const res = await request(app)
      .post(`/api/holdings/${validUuid}/generate`)
      .send({ bullets: "Strong services growth" });

    expect(res.status).toBe(201);
    expect(res.body.thesisId).toBe(thesisId);
  });

  it("returns 500 when agent throws", async () => {
    const holdingRow = {
      id: validUuid,
      ticker: "AAPL",
      companyName: "Apple Inc.",
      direction: "long",
      benchmark: "S&P 500",
      status: "active",
    };

    mockSelect.mockResolvedValueOnce([holdingRow]);
    mockSelect.mockResolvedValueOnce([]);
    mockGenerate.mockRejectedValueOnce(new Error("API rate limit"));

    const res = await request(app)
      .post(`/api/holdings/${validUuid}/generate`)
      .send({ bullets: "Test bullets" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Generation failed");
  });

  it("returns 504 when agent times out", async () => {
    const holdingRow = {
      id: validUuid,
      ticker: "AAPL",
      companyName: "Apple Inc.",
      direction: "long",
      benchmark: "S&P 500",
      status: "active",
    };

    mockSelect.mockResolvedValueOnce([holdingRow]);
    mockSelect.mockResolvedValueOnce([]);

    const timeoutError = new Error("The operation was aborted due to timeout");
    timeoutError.name = "TimeoutError";
    mockGenerate.mockRejectedValueOnce(timeoutError);

    const res = await request(app)
      .post(`/api/holdings/${validUuid}/generate`)
      .send({ bullets: "Test bullets" });

    expect(res.status).toBe(504);
    expect(res.body.error).toContain("timed out");
  });

  it("records failed progress when the agent throws", async () => {
    const holdingRow = {
      id: validUuid,
      ticker: "AAPL",
      companyName: "Apple Inc.",
      direction: "long",
      benchmark: "S&P 500",
      status: "active",
    };

    mockSelect.mockResolvedValueOnce([holdingRow]);
    mockSelect.mockResolvedValueOnce([]);
    mockGenerate.mockRejectedValueOnce(new Error("API rate limit"));

    await request(app)
      .post(`/api/holdings/${validUuid}/generate`)
      .send({ bullets: "Test bullets" });

    expect(getGenerationProgress(validUuid)?.status).toBe("failed");
    expect(getGenerationProgress(validUuid)?.error).toBe("API rate limit");
  });
});

describe("GET /api/holdings/:id/generation-status", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
    clearProgressStore();
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await request(app).get(
      "/api/holdings/not-a-uuid/generation-status",
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when no generation is tracked", async () => {
    const res = await request(app).get(
      `/api/holdings/${validUuid}/generation-status`,
    );
    expect(res.status).toBe(404);
  });

  it("returns complete status with events after a successful generation", async () => {
    const holdingRow = {
      id: validUuid,
      ticker: "AAPL",
      companyName: "Apple Inc.",
      direction: "long",
      benchmark: "S&P 500",
      status: "active",
    };

    mockSelect.mockResolvedValueOnce([holdingRow]);
    mockSelect.mockResolvedValueOnce([]);
    // Simulate a streamed run: the agent reports a web search via onEvent
    mockGenerate.mockImplementationOnce(
      async (_input: unknown, _signal: unknown, onEvent?: Function) => {
        onEvent?.({
          type: "item.completed",
          item: { id: "1", type: "web_search", query: "AAPL earnings" },
        });
        return VALID_THESIS_FIXTURE;
      },
    );
    mockInsert.mockResolvedValueOnce([{ id: "thesis-id" }]);

    await request(app)
      .post(`/api/holdings/${validUuid}/generate`)
      .send({ bullets: "Strong growth" });

    const res = await request(app).get(
      `/api/holdings/${validUuid}/generation-status`,
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("complete");
    expect(res.body.events).toEqual(['Searching: "AAPL earnings"']);
    expect(res.body.startedAt).toBeDefined();
  });
});
