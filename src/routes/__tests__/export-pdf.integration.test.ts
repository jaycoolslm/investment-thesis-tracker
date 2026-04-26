import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";
import { db } from "../../db/index.js";
import { theses, thesisPillars, weeklyLogs } from "../../db/schema.js";
import { cleanAllTables, seedHoldingWithThesis } from "../../__tests__/helpers.js";

const app = createApp();

beforeEach(async () => {
  await cleanAllTables();
});

describe("GET /api/holdings/:id/export/pdf", () => {
  it("returns a PDF with correct headers for a holding with a thesis", async () => {
    const { holding, thesis } = await seedHoldingWithThesis({ ticker: "AAPL" });

    await db.insert(weeklyLogs).values([
      {
        holdingId: holding.id,
        weekLabel: "2026-W15",
        weekDate: "2026-04-11",
        priceChangePct: "2.3456",
        indexChangePct: "0.5000",
        relativePerf: "1.8456",
        thesisImpact: "strengthened",
        summary: "Earnings beat expectations.",
        pillarRefs: [],
      },
      {
        holdingId: holding.id,
        weekLabel: "2026-W14",
        weekDate: "2026-04-04",
        priceChangePct: "-1.2000",
        indexChangePct: "0.1000",
        relativePerf: "-1.3000",
        thesisImpact: "unchanged",
        summary: "Quiet week, no catalysts.",
        pillarRefs: null,
      },
    ]);

    expect(thesis.id).toBeDefined();

    const res = await request(app)
      .get(`/api/holdings/${holding.id}/export/pdf`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (chunk) => chunks.push(chunk));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain("AAPL");
    expect(res.headers["content-disposition"]).toContain(".pdf");
    expect(Number(res.headers["content-length"])).toBeGreaterThan(1024);

    const body = res.body as Buffer;
    expect(body).toBeInstanceOf(Buffer);
    expect(body.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(body.length).toBeGreaterThan(1024);
  });

  it("returns 404 when the holding does not exist", async () => {
    const res = await request(app).get(
      "/api/holdings/00000000-0000-0000-0000-000000000000/export/pdf",
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid holding ID", async () => {
    const res = await request(app).get("/api/holdings/not-a-uuid/export/pdf");
    expect(res.status).toBe(400);
  });

  it("returns 409 when the holding has no thesis", async () => {
    const { holding } = await seedHoldingWithThesis({ ticker: "MSFT" });
    // Remove thesis + pillars to simulate a holding without a thesis
    await db.delete(thesisPillars);
    await db.delete(theses);

    const res = await request(app).get(
      `/api/holdings/${holding.id}/export/pdf`,
    );
    expect(res.status).toBe(409);
  });
});
