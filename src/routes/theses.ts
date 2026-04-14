import { Router } from "express";
import * as z from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { theses, thesisPillars } from "../db/schema.js";

export const thesesRouter = Router();

thesesRouter.get("/holdings/:id/thesis", async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  if (!idResult.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }

  const [thesis] = await db
    .select()
    .from(theses)
    .where(eq(theses.holdingId, idResult.data))
    .orderBy(desc(theses.createdAt))
    .limit(1);

  if (!thesis) {
    res.status(404).json({ error: "No thesis found for this holding" });
    return;
  }

  const pillars = await db
    .select()
    .from(thesisPillars)
    .where(eq(thesisPillars.thesisId, thesis.id))
    .orderBy(thesisPillars.sortOrder);

  res.json({ ...thesis, pillars });
});
