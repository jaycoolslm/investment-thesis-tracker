import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import { createApp } from "../../app.js";
import { db } from "../../db/index.js";
import { holdings, weeklyLogs } from "../../db/schema.js";

const app = createApp();

beforeEach(async () => {
  await db.delete(holdings);
});

describe("Holdings CRUD (integration)", () => {
  it("POST /api/holdings creates a holding", async () => {
    const res = await request(app)
      .post("/api/holdings")
      .send({
        ticker: "AAPL",
        companyName: "Apple Inc.",
        direction: "long",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticker: "AAPL",
      companyName: "Apple Inc.",
      direction: "long",
      benchmark: "S&P 500",
      status: "active",
    });
    expect(res.body.id).toBeDefined();
  });

  it("POST /api/holdings rejects invalid input", async () => {
    const res = await request(app)
      .post("/api/holdings")
      .send({ ticker: "", direction: "sideways" });

    expect(res.status).toBe(400);
  });

  it("GET /api/holdings lists holdings", async () => {
    await request(app)
      .post("/api/holdings")
      .send({ ticker: "AAPL", companyName: "Apple", direction: "long" });
    await request(app)
      .post("/api/holdings")
      .send({ ticker: "MSFT", companyName: "Microsoft", direction: "short" });

    const res = await request(app).get("/api/holdings");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("GET /api/holdings?status=active filters by status", async () => {
    const { body: h1 } = await request(app)
      .post("/api/holdings")
      .send({ ticker: "AAPL", companyName: "Apple", direction: "long" });

    const { body: h2 } = await request(app)
      .post("/api/holdings")
      .send({ ticker: "MSFT", companyName: "Microsoft", direction: "short" });

    // Pause one
    await request(app)
      .put(`/api/holdings/${h2.id}`)
      .send({ status: "paused" });

    const res = await request(app).get("/api/holdings?status=active");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].ticker).toBe("AAPL");
  });

  it("GET /api/holdings/:id returns a single holding", async () => {
    const { body: created } = await request(app)
      .post("/api/holdings")
      .send({ ticker: "TSLA", companyName: "Tesla", direction: "long" });

    const res = await request(app).get(`/api/holdings/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ticker).toBe("TSLA");
  });

  it("GET /api/holdings/:id returns 404 for missing holding", async () => {
    const res = await request(app).get(
      "/api/holdings/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status).toBe(404);
  });

  it("PUT /api/holdings/:id updates a holding", async () => {
    const { body: created } = await request(app)
      .post("/api/holdings")
      .send({ ticker: "AAPL", companyName: "Apple", direction: "long" });

    const res = await request(app)
      .put(`/api/holdings/${created.id}`)
      .send({ status: "closed", benchmark: "NASDAQ Composite" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("closed");
    expect(res.body.benchmark).toBe("NASDAQ Composite");
  });

  it("derives latestImpact/lastUpdated from the most recent weekly log", async () => {
    const { body: created } = await request(app)
      .post("/api/holdings")
      .send({ ticker: "AAPL", companyName: "Apple", direction: "long" });

    // No weekly logs yet — derived fields are null
    const before = await request(app).get("/api/holdings");
    expect(before.body[0].latestImpact).toBeNull();
    expect(before.body[0].lastUpdated).toBeNull();

    // Two logs across different weeks; W20 written after W21 to prove the
    // derivation follows the week label, not insertion order
    await db.insert(weeklyLogs).values({
      holdingId: created.id,
      weekLabel: "2026-W21",
      weekDate: "2026-05-18",
      thesisImpact: "weakened",
      summary: "Later week",
    });
    const [olderLog] = await db
      .insert(weeklyLogs)
      .values({
        holdingId: created.id,
        weekLabel: "2026-W20",
        weekDate: "2026-05-11",
        thesisImpact: "strengthened",
        summary: "Earlier week",
      })
      .returning();
    expect(olderLog.thesisImpact).toBe("strengthened");

    const [latestLog] = await db
      .select()
      .from(weeklyLogs)
      .where(eq(weeklyLogs.weekLabel, "2026-W21"));

    const listRes = await request(app).get("/api/holdings");
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].latestImpact).toBe("weakened");
    expect(new Date(listRes.body[0].lastUpdated).getTime()).toBe(
      latestLog.createdAt.getTime(),
    );

    // Same derivation on the single-holding endpoint
    const singleRes = await request(app).get(`/api/holdings/${created.id}`);
    expect(singleRes.body.latestImpact).toBe("weakened");
  });

  it("DELETE /api/holdings/:id removes a holding", async () => {
    const { body: created } = await request(app)
      .post("/api/holdings")
      .send({ ticker: "AAPL", companyName: "Apple", direction: "long" });

    const deleteRes = await request(app).delete(
      `/api/holdings/${created.id}`,
    );
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/api/holdings/${created.id}`);
    expect(getRes.status).toBe(404);
  });
});
