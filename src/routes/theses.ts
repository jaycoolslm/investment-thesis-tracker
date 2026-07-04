import { Router } from "express";
import * as z from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { theses, weeklyLogs } from "../db/schema.js";
import {
  WeeklyMonitoringService,
  HoldingNotFoundError,
  NoThesisError,
} from "../services/weekly-monitoring.js";

export const thesesRouter = Router();

// ── Zod schemas for editing ──────────────────────────────────────────

const updateThesisSchema = z.object({
  content: z.string().min(1),
});

// ── GET /api/holdings/:id/weekly-logs ────────────────────────────────

thesesRouter.get("/holdings/:id/weekly-logs", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }

  const logs = await db
    .select()
    .from(weeklyLogs)
    .where(eq(weeklyLogs.holdingId, idResult.data))
    .orderBy(desc(weeklyLogs.createdAt));

  res.json(logs);
});

// ── POST /api/holdings/:id/weekly-logs/trigger ───────────────────────

thesesRouter.post("/holdings/:id/weekly-logs/trigger", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }

  const holdingId = idResult.data;
  const service = new WeeklyMonitoringService();

  try {
    const logId = await service.monitorHolding(holdingId);

    if (!logId) {
      res.status(200).json({ skipped: true, message: "Holding is not active" });
      return;
    }

    const [log] = await db
      .select()
      .from(weeklyLogs)
      .where(eq(weeklyLogs.id, logId));

    res.status(201).json(log);
  } catch (err) {
    console.error("[weekly-monitoring] Error for holding", holdingId, err);
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
    if (err instanceof Error && err.name === "TimeoutError") {
      res.status(504).json({
        error: "Weekly monitoring timed out. Please try again.",
      });
      return;
    }
    res.status(500).json({
      error: "Weekly monitoring failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ── GET /api/holdings/:id/thesis ─────────────────────────────────────

thesesRouter.get("/holdings/:id/thesis", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }

  const [thesis] = await db
    .select()
    .from(theses)
    .where(eq(theses.holdingId, idResult.data))
    .orderBy(desc(theses.createdAt))
    .limit(1);

  if (!thesis) {
    res.status(404).json({ error: "No thesis found for this holding" });
    return;
  }

  res.json(thesis);
});

// ── PATCH /api/theses/:id ────────────────────────────────────────────

thesesRouter.patch("/theses/:id", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid thesis ID" });
    return;
  }

  const parsed = updateThesisSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(theses)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(theses.id, idResult.data))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Thesis not found" });
    return;
  }

  res.json(updated);
});
