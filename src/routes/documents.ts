import { Router } from "express";
import multer from "multer";
import { mkdirSync } from "fs";
import { unlink } from "fs/promises";
import * as z from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { documents, holdings } from "../db/schema.js";

export const documentsRouter = Router();

const UPLOAD_DIR = "/data/documents";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB in bytes

const FILE_TYPE_BY_MIMETYPE: Record<string, "PDF" | "DOCX" | "MD"> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "text/markdown": "MD",
};

/**
 * Maps an accepted upload mimetype to its stored `fileType`, or null when the
 * mimetype is not allowed. Single source of truth for the multer filter and the
 * persisted column.
 */
export function deriveFileType(mimetype: string): "PDF" | "DOCX" | "MD" | null {
  return FILE_TYPE_BY_MIMETYPE[mimetype] ?? null;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const holdingId = req.params.id;
    const dir = `${UPLOAD_DIR}/${holdingId}`;
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    cb(null, deriveFileType(file.mimetype) !== null);
  },
});

// POST /api/holdings/:id/documents
documentsRouter.post(
  "/holdings/:id/documents",
  upload.single("file"),
  async (req, res) => {
    const idResult = z.string().uuid().safeParse(req.params.id);
    if (!idResult.success) {
      res.status(400).json({ error: "Invalid holding ID" });
      return;
    }

    // Verify holding exists
    const [holding] = await db
      .select()
      .from(holdings)
      .where(eq(holdings.id, idResult.data));

    if (!holding) {
      res.status(404).json({ error: "Holding not found" });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: "No file uploaded. Only PDF, DOCX, and Markdown files are accepted.",
      });
      return;
    }

    const file = req.file;
    const fileType = deriveFileType(file.mimetype) ?? "DOCX";

    const [doc] = await db
      .insert(documents)
      .values({
        holdingId: idResult.data,
        filename: file.originalname,
        filePath: file.path,
        fileType,
        fileSize: file.size,
      })
      .returning();

    res.status(201).json(doc);
  },
);

// GET /api/holdings/:id/documents
documentsRouter.get("/holdings/:id/documents", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }

  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.holdingId, idResult.data));

  res.json(docs);
});

// DELETE /api/holdings/:id/documents/:docId
documentsRouter.delete("/holdings/:id/documents/:docId", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  const docIdResult = z.string().uuid().safeParse(req.params.docId);
  if (!idResult.success || !docIdResult.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, docIdResult.data),
        eq(documents.holdingId, idResult.data),
      ),
    );

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  await db.delete(documents).where(eq(documents.id, docIdResult.data));

  // Best-effort file cleanup
  try {
    await unlink(doc.filePath);
  } catch {
    // File may already be gone — not critical
  }

  res.status(204).end();
});
