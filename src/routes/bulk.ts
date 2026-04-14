import { Router } from "express";
import multer from "multer";
import * as z from "zod";
import { progressEmitter } from "../progress.js";
import { cancelBatch, enqueueBatch, redisConnection } from "../jobs/queue.js";
import {
  parseBulkFile,
  startBulkGeneration,
  getBatchState,
} from "../services/bulk-generation.js";
import { ParseError } from "../services/file-parser.js";
import { getTemplateBuffer } from "../services/template-generator.js";

export const bulkRouter = Router();

const MAX_BULK_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BULK_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIMETYPES.includes(file.mimetype));
  },
});

// POST /api/bulk-generate — Upload file, parse, validate, return preview
bulkRouter.post(
  "/bulk-generate",
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({
        error:
          "No file uploaded. Upload an .xlsx or .csv file.",
      });
      return;
    }

    try {
      const preview = await parseBulkFile(req.file.buffer, req.file.mimetype);
      res.json(preview);
    } catch (err) {
      if (err instanceof ParseError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({
        error: "Failed to parse file",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

// POST /api/bulk-generate/:batchId/start — Create holdings + enqueue generation
bulkRouter.post("/bulk-generate/:batchId/start", async (req, res) => {
  const batchId = req.params.batchId;
  const bodySchema = z.object({
    excludeRows: z.array(z.number()).optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    console.log(`[bulk-api] Starting batch ${batchId}, excludeRows=${JSON.stringify(parsed.data.excludeRows ?? [])}`);
    const result = await startBulkGeneration(
      batchId,
      parsed.data.excludeRows,
    );
    console.log(`[bulk-api] Batch ${batchId} enqueued: ${result.totalJobs} jobs, holdingIds=${result.holdingIds.join(",")}`);
    res.status(202).json({ batchId, ...result });
  } catch (err) {
    console.error(`[bulk-api] Failed to start batch ${batchId}:`, err);
    res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to start generation",
    });
  }
});

// GET /api/bulk-generate/:batchId/progress — SSE stream
bulkRouter.get("/bulk-generate/:batchId/progress", async (req, res) => {
  const batchId = req.params.batchId;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  // Send current state immediately on connect
  const state = await getBatchState(batchId);
  if (state) {
    res.write(
      `data: ${JSON.stringify({ type: "progress", completed: state.completed, failed: state.failed, total: state.total })}\n\n`,
    );

    if (state.status === "complete" || state.status === "cancelled") {
      res.write(
        `data: ${JSON.stringify({ type: "batch_complete", ...state })}\n\n`,
      );
      setTimeout(() => res.end(), 100);
      return;
    }
  }

  function onEvent(event: Record<string, unknown>) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);

    if (event.type === "batch_complete") {
      setTimeout(() => res.end(), 100);
    }
  }

  progressEmitter.on(batchId, onEvent);

  req.on("close", () => {
    progressEmitter.off(batchId, onEvent);
  });
});

// DELETE /api/bulk-generate/:batchId — Cancel remaining jobs
bulkRouter.delete("/bulk-generate/:batchId", async (req, res) => {
  const batchId = req.params.batchId;

  const state = await getBatchState(batchId);
  if (!state) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  const cancelled = await cancelBatch(batchId);
  await redisConnection.hset(`batch:${batchId}`, "status", "cancelled");

  // Emit completion so SSE clients close
  progressEmitter.emit(batchId, {
    type: "batch_complete",
    completed: state.completed,
    failed: state.failed + cancelled,
    total: state.total,
    failures: state.failures,
    cancelled: true,
  });

  res.json({ cancelled, alreadyCompleted: state.completed });
});

// POST /api/bulk-generate/:batchId/retry — Retry failed holdings
bulkRouter.post("/bulk-generate/:batchId/retry", async (req, res) => {
  const batchId = req.params.batchId;
  const bodySchema = z.object({
    holdingIds: z.array(z.string().uuid()).optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const state = await getBatchState(batchId);
  if (!state) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  // Get failures to retry
  let failuresToRetry = state.failures;
  if (parsed.data.holdingIds) {
    const ids = new Set(parsed.data.holdingIds);
    failuresToRetry = failuresToRetry.filter((f: { holdingId: string }) =>
      ids.has(f.holdingId),
    );
  }

  if (failuresToRetry.length === 0) {
    res.status(400).json({ error: "No failures to retry" });
    return;
  }

  // Clear failures list and reset counters for retried items
  await redisConnection.del(`batch:${batchId}:failures`);
  const multi = redisConnection.multi();
  multi.hset(`batch:${batchId}`, {
    failed: "0",
    status: "active",
    total: String(state.completed + failuresToRetry.length),
  });
  await multi.exec();

  // Re-enqueue
  await enqueueBatch(
    batchId,
    failuresToRetry.map((f: { holdingId: string; ticker: string }) => ({
      holdingId: f.holdingId,
      ticker: f.ticker,
      companyName: f.ticker, // Will be resolved during generation
      direction: "long" as const, // Direction was already set when holding was created
      bullets: "", // Bullets were already used in initial generation; agent re-reads holding
    })),
  );

  res.status(202).json({
    retryCount: failuresToRetry.length,
    holdingIds: failuresToRetry.map((f: { holdingId: string }) => f.holdingId),
  });
});

// GET /api/bulk-generate/template — Download template .xlsx
bulkRouter.get("/bulk-generate/template", async (_req, res) => {
  const buffer = await getTemplateBuffer();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="thesis-tracker-template.xlsx"',
  );
  res.send(buffer);
});
