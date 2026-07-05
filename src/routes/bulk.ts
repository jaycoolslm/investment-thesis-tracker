import { Router } from "express";
import multer from "multer";
import * as z from "zod";
import {
  parseBulkFile,
  startBulkGeneration,
  getBatchState,
  cancelBulkGeneration,
  retryBulkGeneration,
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
    const { totalJobs, holdingIds } = await startBulkGeneration(
      batchId,
      parsed.data.excludeRows,
    );
    console.log(`[bulk-api] Batch ${batchId} started: ${totalJobs} jobs, holdingIds=${holdingIds.join(",")}`);
    res.status(202).json({ batchId, totalJobs, holdingIds });
  } catch (err) {
    console.error(`[bulk-api] Failed to start batch ${batchId}:`, err);
    res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to start generation",
    });
  }
});

// GET /api/bulk-generate/:batchId/status — polled by the frontend while a batch runs
bulkRouter.get("/bulk-generate/:batchId/status", (req, res) => {
  const state = getBatchState(req.params.batchId);
  if (!state) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }
  res.json(state);
});

// DELETE /api/bulk-generate/:batchId — Cancel remaining jobs
bulkRouter.delete("/bulk-generate/:batchId", async (req, res) => {
  const batchId = req.params.batchId;

  const state = getBatchState(batchId);
  if (!state) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  const cancelled = cancelBulkGeneration(batchId);

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

  const result = retryBulkGeneration(batchId, parsed.data.holdingIds);
  if (!result) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  if (result.retryCount === 0) {
    res.status(400).json({ error: "No failures to retry" });
    return;
  }

  res.status(202).json({
    retryCount: result.retryCount,
    holdingIds: result.holdingIds,
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
