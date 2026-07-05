import { Router } from "express";
import { desc, eq, getTableColumns, sql } from "drizzle-orm";
import * as z from "zod";
import { db } from "../db/index.js";
import { holdings, weeklyLogs } from "../db/schema.js";

export const holdingsRouter = Router();

const createHoldingSchema = z.object({
  ticker: z.string().min(1).max(20),
  companyName: z.string().min(1).max(255),
  direction: z.enum(["long", "short"]),
  benchmark: z.string().max(100).optional(),
});

const updateHoldingSchema = z.object({
  ticker: z.string().min(1).max(20).optional(),
  companyName: z.string().min(1).max(255).optional(),
  direction: z.enum(["long", "short"]).optional(),
  benchmark: z.string().max(100).optional(),
  status: z.enum(["active", "closed", "paused"]).optional(),
});

const uuidSchema = z.string().uuid();

/**
 * Select holdings with latestImpact / lastUpdated derived from each
 * holding's most recent weekly log (single round-trip, DISTINCT ON join).
 * Keeps the response shape the dashboard has always consumed.
 */
function selectHoldingsWithDerived() {
  const latestLogs = db
    .selectDistinctOn([weeklyLogs.holdingId], {
      holdingId: weeklyLogs.holdingId,
      latestImpact: weeklyLogs.thesisImpact,
      lastUpdated: weeklyLogs.createdAt,
    })
    .from(weeklyLogs)
    .orderBy(weeklyLogs.holdingId, desc(weeklyLogs.weekLabel))
    .as("latest_logs");

  return db
    .select({
      ...getTableColumns(holdings),
      latestImpact: latestLogs.latestImpact,
      lastUpdated: latestLogs.lastUpdated,
    })
    .from(holdings)
    .leftJoin(latestLogs, eq(latestLogs.holdingId, holdings.id));
}

// GET /api/holdings?status=active|closed|paused|all (default: all)
holdingsRouter.get("/holdings", async (req, res) => {
  const statusParam = z
    .enum(["active", "closed", "paused", "all"])
    .default("all")
    .safeParse(req.query.status);

  const status = statusParam.success ? statusParam.data : "all";

  const query = selectHoldingsWithDerived();
  const rows =
    status === "all"
      ? await query.orderBy(holdings.ticker)
      : await query
          .where(eq(holdings.status, status))
          .orderBy(holdings.ticker);

  // Find holdings with 3+ consecutive weakened weeks
  const streakResult = await db.execute<{ holding_id: string }>(sql`
    WITH ranked AS (
      SELECT holding_id, thesis_impact,
        ROW_NUMBER() OVER (PARTITION BY holding_id ORDER BY week_label DESC) AS rn
      FROM weekly_logs
    )
    SELECT holding_id FROM ranked
    WHERE rn <= 3
    GROUP BY holding_id
    HAVING COUNT(*) = 3
      AND COUNT(*) FILTER (WHERE thesis_impact = 'weakened') = 3
  `);

  const streakIds = new Set(streakResult.rows.map((r) => r.holding_id));

  res.json(
    rows.map((h) => ({
      ...h,
      weakenedStreak: streakIds.has(h.id),
    })),
  );
});

// POST /api/holdings
holdingsRouter.post("/holdings", async (req, res) => {
  const parsed = createHoldingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [created] = await db.insert(holdings).values(parsed.data).returning();
  res.status(201).json(created);
});

// GET /api/holdings/:id
holdingsRouter.get("/holdings/:id", async (req, res) => {
  const idParsed = uuidSchema.safeParse(req.params.id);
  if (!idParsed.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }
  const [holding] = await selectHoldingsWithDerived().where(
    eq(holdings.id, idParsed.data),
  );
  if (!holding) {
    res.status(404).json({ error: "Holding not found" });
    return;
  }
  res.json(holding);
});

// PUT /api/holdings/:id
holdingsRouter.put("/holdings/:id", async (req, res) => {
  const idParsed = uuidSchema.safeParse(req.params.id);
  if (!idParsed.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }
  const parsed = updateHoldingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [updated] = await db
    .update(holdings)
    .set(parsed.data)
    .where(eq(holdings.id, idParsed.data))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Holding not found" });
    return;
  }
  res.json(updated);
});

// DELETE /api/holdings/:id
holdingsRouter.delete("/holdings/:id", async (req, res) => {
  const idParsed = uuidSchema.safeParse(req.params.id);
  if (!idParsed.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }
  const [deleted] = await db
    .delete(holdings)
    .where(eq(holdings.id, idParsed.data))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Holding not found" });
    return;
  }
  res.status(204).send();
});
