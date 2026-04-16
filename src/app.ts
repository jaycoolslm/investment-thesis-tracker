import path from "node:path";
import express from "express";
import cors from "cors";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { holdingsRouter } from "./routes/holdings.js";
import { generationRouter } from "./routes/generation.js";
import { thesesRouter } from "./routes/theses.js";
import { documentsRouter } from "./routes/documents.js";
import { bulkRouter } from "./routes/bulk.js";
import { monitoringRouter } from "./routes/monitoring.js";
import { config } from "./config.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", holdingsRouter);
  app.use("/api", generationRouter);
  app.use("/api", thesesRouter);
  app.use("/api", documentsRouter);
  app.use("/api", bulkRouter);
  app.use("/api", monitoringRouter);

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

  // In production, serve the Vite-built frontend as static files
  if (config.NODE_ENV === "production") {
    const staticDir = path.resolve(import.meta.dirname, "../web/dist");
    app.use(express.static(staticDir));

    // SPA fallback — Express 5 requires named wildcard
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  return app;
}
