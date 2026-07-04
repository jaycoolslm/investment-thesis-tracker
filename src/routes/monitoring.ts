import { Router } from "express";
import { sql } from "drizzle-orm";
import { progressEmitter } from "../progress.js";
import { getBatch, type BatchState } from "../services/batch-runner.js";
import { runMonitoringBatch, monitoringBatchId } from "../jobs/scheduler.js";
import { getCurrentWeek } from "../services/weekly-monitoring.js";
import { db } from "../db/index.js";

export const monitoringRouter = Router();

function toStatusPayload(state: BatchState) {
  return {
    total: state.total,
    completed: state.completed,
    failed: state.failed,
    status: state.status,
    startedAt: state.startedAt,
  };
}

/** Derive a completed-batch summary from weekly_logs (fresh-process fallback). */
async function summaryFromLogs(weekLabel: string) {
  const rows = await db.execute<{ total: string; started_at: string }>(sql`
    SELECT COUNT(*)::text AS total, MIN(created_at)::text AS started_at
    FROM weekly_logs
    WHERE week_label = ${weekLabel}
  `);
  const total = parseInt(rows.rows[0]?.total ?? "0", 10);
  if (total === 0) return null;

  return {
    total,
    completed: total,
    failed: 0,
    status: "complete" as const,
    startedAt: rows.rows[0].started_at,
  };
}

function previousWeekLabel(): string {
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  return getCurrentWeek(lastWeek).weekLabel;
}

// POST /api/monitoring/trigger — Manually trigger batch monitoring for all active holdings
monitoringRouter.post("/monitoring/trigger", async (_req, res) => {
  try {
    const result = await runMonitoringBatch();

    if (!result) {
      const { weekLabel } = getCurrentWeek();
      const existing = getBatch(monitoringBatchId(weekLabel));
      if (existing?.status === "active") {
        res.status(409).json({
          error: `Batch already running for ${weekLabel}`,
          weekLabel,
          ...toStatusPayload(existing),
        });
        return;
      }
      res.status(200).json({ message: "Nothing to monitor this week" });
      return;
    }

    res.status(202).json({
      weekLabel: result.weekLabel,
      total: result.total,
      status: "active",
    });
  } catch (err) {
    console.error("[monitoring-api] Trigger failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to trigger monitoring",
    });
  }
});

// GET /api/monitoring/status — Get current or latest batch status
monitoringRouter.get("/monitoring/status", async (_req, res) => {
  const { weekLabel } = getCurrentWeek();
  const prevWeek = previousWeekLabel();

  // Registry first (this process ran or is running a batch)
  for (const label of [weekLabel, prevWeek]) {
    const state = getBatch(monitoringBatchId(label));
    if (state) {
      res.json({ weekLabel: label, ...toStatusPayload(state) });
      return;
    }
  }

  // Fresh process: derive a completed summary from weekly_logs
  for (const label of [weekLabel, prevWeek]) {
    const summary = await summaryFromLogs(label);
    if (summary) {
      res.json({ weekLabel: label, ...summary });
      return;
    }
  }

  res.status(404).json({ error: "No monitoring batch found" });
});

// GET /api/monitoring/progress — SSE stream for batch progress events
monitoringRouter.get("/monitoring/progress", async (req, res) => {
  const { weekLabel } = getCurrentWeek();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  // Send current state immediately on connect
  const state = getBatch(monitoringBatchId(weekLabel));
  if (state) {
    res.write(
      `data: ${JSON.stringify({ type: "progress", completed: state.completed, failed: state.failed, total: state.total })}\n\n`,
    );

    if (state.status === "complete") {
      res.write(
        `data: ${JSON.stringify({ type: "batch_complete", ...toStatusPayload(state), failures: state.failures })}\n\n`,
      );
      setTimeout(() => res.end(), 100);
      return;
    }
  }

  const eventKey = monitoringBatchId(weekLabel);

  function onEvent(event: Record<string, unknown>) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);

    if (event.type === "batch_complete") {
      setTimeout(() => res.end(), 100);
    }
  }

  progressEmitter.on(eventKey, onEvent);

  req.on("close", () => {
    progressEmitter.off(eventKey, onEvent);
  });
});

// GET /api/monitoring/history — Past batch run summaries aggregated from weekly_logs
monitoringRouter.get("/monitoring/history", async (_req, res) => {
  const rows = await db.execute<{
    week_label: string;
    week_date: string;
    total: string;
    strengthened: string;
    weakened: string;
    unchanged: string;
    started_at: string;
  }>(sql`
    SELECT
      week_label,
      week_date,
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE thesis_impact = 'strengthened')::text AS strengthened,
      COUNT(*) FILTER (WHERE thesis_impact = 'weakened')::text AS weakened,
      COUNT(*) FILTER (WHERE thesis_impact = 'unchanged')::text AS unchanged,
      MIN(created_at)::text AS started_at
    FROM weekly_logs
    GROUP BY week_label, week_date
    ORDER BY week_date DESC
    LIMIT 20
  `);

  res.json(
    rows.rows.map((r) => ({
      weekLabel: r.week_label,
      weekDate: r.week_date,
      total: parseInt(r.total, 10),
      strengthened: parseInt(r.strengthened, 10),
      weakened: parseInt(r.weakened, 10),
      unchanged: parseInt(r.unchanged, 10),
      startedAt: r.started_at,
    })),
  );
});
