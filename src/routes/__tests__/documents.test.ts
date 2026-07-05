import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock config
vi.mock("../../config.js", () => ({
  config: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    PORT: 3001,
    NODE_ENV: "test",
    OPENAI_API_KEY: "test-key",
  },
}));

// Mock the progress emitter
vi.mock("../../progress.js", () => ({
  progressEmitter: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

// Mock the agent
vi.mock("../../agent/codex-agent.js", () => ({
  ThesisAgent: class MockThesisAgent {
    generateThesis = vi.fn();
  },
}));

const mockSelectWhere = vi.fn();

vi.mock("../../db/index.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockSelectWhere,
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    transaction: vi.fn(),
  },
}));

const { createApp } = await import("../../app.js");
const app = createApp();

describe("GET /api/holdings/:id/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await request(app).get("/api/holdings/not-uuid/documents");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid holding ID");
  });

  it("returns empty array when no documents exist", async () => {
    mockSelectWhere.mockResolvedValueOnce([]);

    const res = await request(app).get(
      "/api/holdings/550e8400-e29b-41d4-a716-446655440000/documents",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns documents for a holding", async () => {
    const docs = [
      {
        id: "doc-1",
        holdingId: "550e8400-e29b-41d4-a716-446655440000",
        filename: "report.pdf",
        filePath: "/data/documents/abc/report.pdf",
        fileType: "PDF",
        fileSize: 1024,
        createdAt: new Date().toISOString(),
      },
      {
        id: "doc-2",
        holdingId: "550e8400-e29b-41d4-a716-446655440000",
        filename: "earnings.docx",
        filePath: "/data/documents/abc/earnings.docx",
        fileType: "DOCX",
        fileSize: 2048,
        createdAt: new Date().toISOString(),
      },
    ];
    mockSelectWhere.mockResolvedValueOnce(docs);

    const res = await request(app).get(
      "/api/holdings/550e8400-e29b-41d4-a716-446655440000/documents",
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].filename).toBe("report.pdf");
    expect(res.body[1].fileType).toBe("DOCX");
  });
});
