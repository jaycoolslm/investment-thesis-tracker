import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import * as z from "zod";
import { db } from "../db/index.js";
import { holdings } from "../db/schema.js";
import {
  exportThesisPdf,
  HoldingNotFoundError,
  NoThesisError,
} from "../services/pdf-export.js";

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

// GET /api/holdings?status=active|closed|paused|all (default: all)
holdingsRouter.get("/holdings", async (req, res) => {
  const statusParam = z
    .enum(["active", "closed", "paused", "all"])
    .default("all")
    .safeParse(req.query.status);

  const status = statusParam.success ? statusParam.data : "all";

  const query = db.select().from(holdings);
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
  const [holding] = await db
    .select()
    .from(holdings)
    .where(eq(holdings.id, idParsed.data));
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

// GET /api/holdings/:id/export/pdf
holdingsRouter.get("/holdings/:id/export/pdf", async (req, res) => {
  const idParsed = uuidSchema.safeParse(req.params.id);
  if (!idParsed.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }

  try {
    const { buffer, filename } = await exportThesisPdf(idParsed.data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    if (err instanceof HoldingNotFoundError) {
      res.status(404).json({ error: "Holding not found" });
      return;
    }
    if (err instanceof NoThesisError) {
      res.status(409).json({
        error: "No thesis exists for this holding. Generate a thesis first.",
      });
      return;
    }
    console.error("[pdf-export] Error for holding", idParsed.data, err);
    res.status(500).json({
      error: "PDF export failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
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
