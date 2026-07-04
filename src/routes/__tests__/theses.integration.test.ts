import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";
import { db } from "../../db/index.js";
import { holdings, theses } from "../../db/schema.js";

const app = createApp();

let holdingId: string;
let thesisId: string;

const INITIAL_CONTENT = `## Summary

Test thesis summary — a durable compounder with a widening moat.

## Risks

- **Medium:** Competition intensifies.`;

beforeEach(async () => {
  await db.delete(theses);
  await db.delete(holdings);

  // Create a holding and thesis for each test
  const [holding] = await db
    .insert(holdings)
    .values({
      ticker: "AAPL",
      companyName: "Apple Inc.",
      direction: "long",
    })
    .returning();
  holdingId = holding.id;

  const [thesis] = await db
    .insert(theses)
    .values({
      holdingId: holding.id,
      content: INITIAL_CONTENT,
      // Legacy stored shape: pre-spec-07 sources carried a `type` field.
      // The API must keep serving them unchanged (read-side tolerance).
      sources: [{ title: "Q1 filing", url: null, type: "filing" }],
    })
    .returning();
  thesisId = thesis.id;
});

describe("Thesis editing (integration)", () => {
  it("GET /api/holdings/:id/thesis returns the markdown thesis", async () => {
    const res = await request(app).get(`/api/holdings/${holdingId}/thesis`);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe(INITIAL_CONTENT);
    expect(res.body.sources).toHaveLength(1);
    // The old structured columns no longer leak through
    expect(res.body.summary).toBeUndefined();
    expect(res.body.valuation).toBeUndefined();
  });

  it("PATCH /api/theses/:id updates the content", async () => {
    const res = await request(app)
      .patch(`/api/theses/${thesisId}`)
      .send({ content: "## Summary\n\nUpdated thesis document." });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("## Summary\n\nUpdated thesis document.");
  });

  it("PATCH /api/theses/:id rejects empty content", async () => {
    const res = await request(app)
      .patch(`/api/theses/${thesisId}`)
      .send({ content: "" });

    expect(res.status).toBe(400);
  });

  it("PATCH /api/theses/:id rejects a request with no content field", async () => {
    const res = await request(app).patch(`/api/theses/${thesisId}`).send({});

    expect(res.status).toBe(400);
  });

  it("cascade delete: removing holding deletes the thesis", async () => {
    await request(app).delete(`/api/holdings/${holdingId}`);

    const thesisRes = await request(app).get(
      `/api/holdings/${holdingId}/thesis`,
    );
    expect(thesisRes.status).toBe(404);
  });
});

describe("Weekly logs endpoint (integration)", () => {
  it("GET /api/holdings/:id/weekly-logs returns empty array initially", async () => {
    const res = await request(app).get(
      `/api/holdings/${holdingId}/weekly-logs`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
