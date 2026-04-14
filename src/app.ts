import express from "express";
import cors from "cors";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { holdingsRouter } from "./routes/holdings.js";
import { generationRouter } from "./routes/generation.js";
import { thesesRouter } from "./routes/theses.js";
import { documentsRouter } from "./routes/documents.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", holdingsRouter);
  app.use("/api", generationRouter);
  app.use("/api", thesesRouter);
  app.use("/api", documentsRouter);

  app.get("/api/health", async (_req, res) => {
    try {
      await db.execute(sql`SELECT 1`);
      res.json({
        status: "ok",
        db: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: "error",
        db: "disconnected",
        timestamp: new Date().toISOString(),
      });
    }
  });

  return app;
}
