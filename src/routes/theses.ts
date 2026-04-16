import { Router } from "express";
import * as z from "zod";
import { eq, desc, max } from "drizzle-orm";
import { db } from "../db/index.js";
import { theses, thesisPillars, weeklyLogs } from "../db/schema.js";
import { valuationSchema, riskSchema } from "../agent/schemas.js";
import {
  WeeklyMonitoringService,
  HoldingNotFoundError,
  NoThesisError,
  type MonitoringProgressEvent,
} from "../services/weekly-monitoring.js";
import { progressEmitter } from "../progress.js";

export const thesesRouter = Router();

// ── Zod schemas for editing ──────────────────────────────────────────

const updateThesisSchema = z
  .object({
    summary: z.string().optional(),
    qualityAssess: z.string().optional(),
    valuation: valuationSchema.optional(),
    assumptions: z.array(z.string().min(1)).optional(),
    risks: z.array(riskSchema).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, "At least one field required");

const createPillarSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().optional(),
});

const updatePillarSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    body: z.string().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, "At least one field required");

const reorderPillarsSchema = z.object({
  pillarIds: z.array(z.string().uuid()).min(1),
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

// ── GET /api/holdings/:id/weekly-logs/progress (SSE) ─────────────────

thesesRouter.get("/holdings/:id/weekly-logs/progress", (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }

  const holdingId = idResult.data;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.flushHeaders();

  function onProgress(event: MonitoringProgressEvent) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);

    if (
      event.type === "complete" ||
      event.type === "failed" ||
      event.type === "skipped"
    ) {
      setTimeout(() => res.end(), 100);
    }
  }

  progressEmitter.on(`monitoring:${holdingId}`, onProgress);

  req.on("close", () => {
    progressEmitter.off(`monitoring:${holdingId}`, onProgress);
  });
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

  service.on("progress", (event: MonitoringProgressEvent) => {
    progressEmitter.emit(`monitoring:${holdingId}`, event);
  });

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

  const pillars = await db
    .select()
    .from(thesisPillars)
    .where(eq(thesisPillars.thesisId, thesis.id))
    .orderBy(thesisPillars.sortOrder);

  res.json({ ...thesis, pillars });
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

// ── POST /api/theses/:id/pillars ─────────────────────────────────────

thesesRouter.post("/theses/:id/pillars", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid thesis ID" });
    return;
  }

  const parsed = createPillarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  // Verify thesis exists
  const [thesis] = await db
    .select({ id: theses.id })
    .from(theses)
    .where(eq(theses.id, idResult.data));

  if (!thesis) {
    res.status(404).json({ error: "Thesis not found" });
    return;
  }

  // Get max sortOrder for this thesis
  const [maxResult] = await db
    .select({ maxOrder: max(thesisPillars.sortOrder) })
    .from(thesisPillars)
    .where(eq(thesisPillars.thesisId, idResult.data));

  const nextOrder = (maxResult?.maxOrder ?? -1) + 1;

  const [pillar] = await db
    .insert(thesisPillars)
    .values({
      thesisId: idResult.data,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      sortOrder: nextOrder,
    })
    .returning();

  res.status(201).json(pillar);
});

// ── PATCH /api/theses/:id/pillars/reorder ────────────────────────────
// NOTE: This route must be defined BEFORE the :pid route

thesesRouter.patch("/theses/:id/pillars/reorder", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid thesis ID" });
    return;
  }

  const parsed = reorderPillarsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  await db.transaction(async (tx) => {
    for (const [index, pillarId] of parsed.data.pillarIds.entries()) {
      await tx
        .update(thesisPillars)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(thesisPillars.id, pillarId));
    }
  });

  // Return updated pillars in new order
  const pillars = await db
    .select()
    .from(thesisPillars)
    .where(eq(thesisPillars.thesisId, idResult.data))
    .orderBy(thesisPillars.sortOrder);

  res.json(pillars);
});

// ── PATCH /api/theses/:id/pillars/:pid ───────────────────────────────

thesesRouter.patch("/theses/:id/pillars/:pid", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  const pidResult = z.string().uuid().safeParse(req.params.pid);
  if (!idResult.success || !pidResult.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = updatePillarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(thesisPillars)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(thesisPillars.id, pidResult.data))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Pillar not found" });
    return;
  }

  res.json(updated);
});

// ── DELETE /api/theses/:id/pillars/:pid ──────────────────────────────

thesesRouter.delete("/theses/:id/pillars/:pid", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  const pidResult = z.string().uuid().safeParse(req.params.pid);
  if (!idResult.success || !pidResult.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [deleted] = await db
    .delete(thesisPillars)
    .where(eq(thesisPillars.id, pidResult.data))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Pillar not found" });
    return;
  }

  res.status(204).end();
});
