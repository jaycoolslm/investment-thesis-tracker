import { Router } from "express";
import multer from "multer";
import { mkdirSync } from "fs";
import * as z from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { documents, holdings } from "../db/schema.js";

export const documentsRouter = Router();

const UPLOAD_DIR = "/data/documents";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB in bytes
const ALLOWED_MIMETYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

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
    cb(null, ALLOWED_MIMETYPES.includes(file.mimetype));
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
      res
        .status(400)
        .json({ error: "No file uploaded. Only PDF and DOCX files are accepted." });
      return;
    }

    const file = req.file;
    const fileType = file.mimetype === "application/pdf" ? "PDF" : "DOCX";

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
