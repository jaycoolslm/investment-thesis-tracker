import { Router } from "express";
import * as z from "zod";
import {
  ThesisGenerationService,
  HoldingNotFoundError,
  type ProgressEvent,
} from "../services/thesis-generation.js";
import { progressEmitter } from "../progress.js";

export const generationRouter = Router();

const generateBodySchema = z.object({
  bullets: z.string().min(1, "At least one thesis bullet is required"),
});

// SSE endpoint — client opens this BEFORE triggering generation
generationRouter.get("/holdings/:id/progress", (req, res) => {
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

  // Flush headers immediately so EventSource fires onopen
  res.flushHeaders();

  function onProgress(event: ProgressEvent) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);

    if (event.type === "complete" || event.type === "failed") {
      // Give client a moment to process the final event, then close
      setTimeout(() => res.end(), 100);
    }
  }

  progressEmitter.on(holdingId, onProgress);

  req.on("close", () => {
    progressEmitter.off(holdingId, onProgress);
  });
});

// Generation trigger
generationRouter.post("/holdings/:id/generate", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }

  const bodyResult = generateBodySchema.safeParse(req.body);
  if (!bodyResult.success) {
    res.status(400).json({
      error: "Validation failed",
      details: bodyResult.error.issues,
    });
    return;
  }

  const holdingId = idResult.data;
  const service = new ThesisGenerationService();

  // Forward progress events to any SSE listeners
  service.on("progress", (event: ProgressEvent) => {
    progressEmitter.emit(holdingId, event);
  });

  try {
    const thesisId = await service.generate(holdingId, bodyResult.data.bullets);
    res.status(201).json({ thesisId });
  } catch (err) {
    console.error("[generate] Error for holding", holdingId, err);
    if (err instanceof HoldingNotFoundError) {
      res.status(404).json({ error: "Holding not found" });
      return;
    }
    if (err instanceof Error && err.name === "TimeoutError") {
      res.status(504).json({
        error: "Generation timed out. Please try again.",
      });
      return;
    }
    res.status(500).json({
      error: "Generation failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
