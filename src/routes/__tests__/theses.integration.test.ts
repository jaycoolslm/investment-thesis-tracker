import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../app.js";
import { db } from "../../db/index.js";
import { holdings, theses, thesisPillars } from "../../db/schema.js";

const app = createApp();

let holdingId: string;
let thesisId: string;

beforeEach(async () => {
  await db.delete(thesisPillars);
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
      summary: "Test thesis summary.",
      qualityAssess: "Strong financials.",
      assumptions: ["Revenue grows 10%"],
      risks: [{ description: "Competition", severity: "medium" }],
    })
    .returning();
  thesisId = thesis.id;
});

describe("Thesis editing (integration)", () => {
  it("GET /api/holdings/:id/thesis returns thesis with pillars", async () => {
    // Add pillars
    await db.insert(thesisPillars).values([
      { thesisId, title: "Pillar A", body: "Body A", sortOrder: 0 },
      { thesisId, title: "Pillar B", body: "Body B", sortOrder: 1 },
    ]);

    const res = await request(app).get(`/api/holdings/${holdingId}/thesis`);
    expect(res.status).toBe(200);
    expect(res.body.summary).toBe("Test thesis summary.");
    expect(res.body.pillars).toHaveLength(2);
    expect(res.body.pillars[0].title).toBe("Pillar A");
  });

  it("PATCH /api/theses/:id updates thesis fields", async () => {
    const res = await request(app)
      .patch(`/api/theses/${thesisId}`)
      .send({ summary: "Updated summary", assumptions: ["New assumption"] });

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe("Updated summary");
    expect(res.body.assumptions).toEqual(["New assumption"]);
  });

  it("POST /api/theses/:id/pillars creates a pillar", async () => {
    const res = await request(app)
      .post(`/api/theses/${thesisId}/pillars`)
      .send({ title: "New Pillar", body: "Pillar body text" });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("New Pillar");
    expect(res.body.thesisId).toBe(thesisId);
  });

  it("PATCH /api/theses/:id/pillars/:pid updates a pillar", async () => {
    const { body: pillar } = await request(app)
      .post(`/api/theses/${thesisId}/pillars`)
      .send({ title: "Original", body: "Original body" });

    const res = await request(app)
      .patch(`/api/theses/${thesisId}/pillars/${pillar.id}`)
      .send({ title: "Edited" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Edited");
  });

  it("PATCH /api/theses/:id/pillars/reorder reorders pillars", async () => {
    const { body: p1 } = await request(app)
      .post(`/api/theses/${thesisId}/pillars`)
      .send({ title: "First" });
    const { body: p2 } = await request(app)
      .post(`/api/theses/${thesisId}/pillars`)
      .send({ title: "Second" });

    const res = await request(app)
      .patch(`/api/theses/${thesisId}/pillars/reorder`)
      .send({ pillarIds: [p2.id, p1.id] });

    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe("Second");
    expect(res.body[1].title).toBe("First");
  });

  it("DELETE /api/theses/:id/pillars/:pid removes a pillar", async () => {
    const { body: pillar } = await request(app)
      .post(`/api/theses/${thesisId}/pillars`)
      .send({ title: "To Delete" });

    const res = await request(app).delete(
      `/api/theses/${thesisId}/pillars/${pillar.id}`,
    );
    expect(res.status).toBe(204);

    // Verify gone
    const thesisRes = await request(app).get(
      `/api/holdings/${holdingId}/thesis`,
    );
    const pillarIds = thesisRes.body.pillars.map(
      (p: { id: string }) => p.id,
    );
    expect(pillarIds).not.toContain(pillar.id);
  });

  it("cascade delete: removing holding deletes thesis and pillars", async () => {
    await request(app)
      .post(`/api/theses/${thesisId}/pillars`)
      .send({ title: "Cascade test" });

    await request(app).delete(`/api/holdings/${holdingId}`);

    // Thesis should be gone
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
