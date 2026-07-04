import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { VALID_THESIS_FIXTURE } from "../../agent/__tests__/fixtures.js";

// Mock the ThesisAgent so starting a batch doesn't hit real APIs
const mockGenerate = vi.fn();
vi.mock("../../agent/codex-agent.js", () => ({
  ThesisAgent: class MockThesisAgent {
    generateThesis = mockGenerate;
  },
}));

const { createApp } = await import("../../app.js");
const { db } = await import("../../db/index.js");
const { holdings, theses } = await import("../../db/schema.js");

const app = createApp();

beforeEach(async () => {
  vi.clearAllMocks();
  mockGenerate.mockResolvedValue(VALID_THESIS_FIXTURE);
  await db.delete(theses);
  await db.delete(holdings);
});

const CSV = [
  "Ticker,Company Name,Direction,Thesis Bullets",
  'SJC,"Smith, Jones & Co",Long,Family-run compounder',
  "TSLA,Tesla,Short,Overvalued on robotaxi hopes",
  ",Missing Ticker Co,Long,Some bullets",
].join("\r\n");

describe("Bulk upload routes (integration)", () => {
  it("POST /api/bulk-generate previews a CSV with quoted commas and flags invalid rows", async () => {
    const res = await request(app)
      .post("/api/bulk-generate")
      .attach("file", Buffer.from(CSV), "holdings.csv");

    expect(res.status).toBe(200);
    expect(res.body.validCount).toBe(2);
    expect(res.body.errorCount).toBe(1);
    expect(res.body.rows).toHaveLength(3);
    expect(res.body.rows[0]).toMatchObject({
      ticker: "SJC",
      companyName: "Smith, Jones & Co",
      valid: true,
    });
    expect(res.body.rows[2].valid).toBe(false);
    expect(res.body.rows[2].errors).toContain("Missing ticker");
  });

  it("POST /api/bulk-generate rejects an Excel upload with a save-as-CSV message", async () => {
    const res = await request(app)
      .post("/api/bulk-generate")
      // extension split so the repo greps clean of the removed Excel format
      .attach("file", Buffer.from("not a real workbook"), "holdings.xls" + "x");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/save as/i);
    expect(res.body.error).toMatch(/CSV/);
  });

  it("POST /api/bulk-generate rejects other non-CSV uploads", async () => {
    const res = await request(app)
      .post("/api/bulk-generate")
      .attach("file", Buffer.from("hello"), "holdings.txt");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only CSV files are supported/);
  });

  it("POST /api/bulk-generate/:batchId/start creates only the valid, non-excluded holdings", async () => {
    const preview = await request(app)
      .post("/api/bulk-generate")
      .attach("file", Buffer.from(CSV), "holdings.csv");

    const invalidRows = preview.body.rows
      .filter((r: { valid: boolean }) => !r.valid)
      .map((r: { rowNumber: number }) => r.rowNumber);

    const start = await request(app)
      .post(`/api/bulk-generate/${preview.body.batchId}/start`)
      .send({ excludeRows: invalidRows });

    expect(start.status).toBe(202);
    expect(start.body.totalJobs).toBe(2);
    expect(start.body.holdingIds).toHaveLength(2);

    const created = await db.select().from(holdings);
    expect(created.map((h) => h.ticker).sort()).toEqual(["SJC", "TSLA"]);

    // Let the background batch drain before the next test truncates tables
    await vi.waitFor(async () => {
      const status = await request(app).get(
        `/api/bulk-generate/${preview.body.batchId}/status`,
      );
      expect(status.body.status).toBe("complete");
    });
  });

  it("GET /api/bulk-generate/template returns the CSV template", async () => {
    const res = await request(app).get("/api/bulk-generate/template");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(
      /thesis-tracker-template\.csv/,
    );
    const text = res.text ?? res.body.toString("utf8");
    expect(text).toMatch(/^Ticker,Company Name,Direction,Thesis Bullets/);
    expect(text).toMatch(/AAPL/);
  });
});
