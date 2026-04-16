import { Router } from "express";
import { progressEmitter } from "../progress.js";
import { getMonitoringBatchState } from "../jobs/queue.js";
import { runMonitoringBatch } from "../jobs/scheduler.js";
import { getCurrentWeek } from "../services/weekly-monitoring.js";

export const monitoringRouter = Router();

// POST /api/monitoring/trigger — Manually trigger batch monitoring for all active holdings
monitoringRouter.post("/monitoring/trigger", async (_req, res) => {
  try {
    const result = await runMonitoringBatch();

    if (!result) {
      const { weekLabel } = getCurrentWeek();
      const existing = await getMonitoringBatchState(weekLabel);
      if (existing) {
        res.status(409).json({
          error: `Batch already exists for ${weekLabel}`,
          weekLabel,
          ...existing,
        });
        return;
      }
      res.status(200).json({ message: "No active holdings with theses to monitor" });
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
  let state = await getMonitoringBatchState(weekLabel);

  // Fall back to previous week if current week has no batch
  if (!state) {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const { weekLabel: prevWeekLabel } = getCurrentWeek(lastWeek);
    state = await getMonitoringBatchState(prevWeekLabel);
    if (state) {
      res.json({ weekLabel: prevWeekLabel, ...state });
      return;
    }
    res.status(404).json({ error: "No monitoring batch found" });
    return;
  }

  res.json({ weekLabel, ...state });
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
  const state = await getMonitoringBatchState(weekLabel);
  if (state) {
    res.write(
      `data: ${JSON.stringify({ type: "progress", completed: state.completed, failed: state.failed, total: state.total })}\n\n`,
    );

    if (state.status === "complete") {
      res.write(
        `data: ${JSON.stringify({ type: "batch_complete", ...state })}\n\n`,
      );
      setTimeout(() => res.end(), 100);
      return;
    }
  }

  const eventKey = `monitoring:${weekLabel}`;

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
