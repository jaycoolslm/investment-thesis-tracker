import { Router } from "express";
import * as z from "zod";
import {
  ThesisGenerationService,
  HoldingNotFoundError,
} from "../services/thesis-generation.js";
import { getGenerationProgress } from "../services/progress-store.js";

export const generationRouter = Router();

const generateBodySchema = z.object({
  bullets: z.string().min(1, "At least one thesis bullet is required"),
});

// Polled by the frontend while a generation is running
generationRouter.get("/holdings/:id/generation-status", (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }

  const progress = getGenerationProgress(idResult.data);
  if (!progress) {
    res.status(404).json({ error: "No generation in progress" });
    return;
  }

  res.json(progress);
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
