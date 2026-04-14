import { Router } from "express";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "../db/index.js";
import { holdings } from "../db/schema.js";

export const holdingsRouter = Router();

const createHoldingSchema = z.object({
  ticker: z.string().min(1).max(20),
  companyName: z.string().min(1).max(255),
  direction: z.enum(["long", "short"]),
  benchmark: z.string().max(100).optional(),
});

const updateHoldingSchema = z.object({
  ticker: z.string().min(1).max(20).optional(),
  companyName: z.string().min(1).max(255).optional(),
  direction: z.enum(["long", "short"]).optional(),
  benchmark: z.string().max(100).optional(),
  status: z.enum(["active", "closed", "paused"]).optional(),
});

const uuidSchema = z.string().uuid();

// GET /api/holdings
holdingsRouter.get("/holdings", async (_req, res) => {
  const rows = await db.select().from(holdings).orderBy(holdings.ticker);
  res.json(rows);
});

// POST /api/holdings
holdingsRouter.post("/holdings", async (req, res) => {
  const parsed = createHoldingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [created] = await db.insert(holdings).values(parsed.data).returning();
  res.status(201).json(created);
});

// GET /api/holdings/:id
holdingsRouter.get("/holdings/:id", async (req, res) => {
  const idParsed = uuidSchema.safeParse(req.params.id);
  if (!idParsed.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }
  const [holding] = await db
    .select()
    .from(holdings)
    .where(eq(holdings.id, idParsed.data));
  if (!holding) {
    res.status(404).json({ error: "Holding not found" });
    return;
  }
  res.json(holding);
});

// PUT /api/holdings/:id
holdingsRouter.put("/holdings/:id", async (req, res) => {
  const idParsed = uuidSchema.safeParse(req.params.id);
  if (!idParsed.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }
  const parsed = updateHoldingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [updated] = await db
    .update(holdings)
    .set(parsed.data)
    .where(eq(holdings.id, idParsed.data))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Holding not found" });
    return;
  }
  res.json(updated);
});

// DELETE /api/holdings/:id
holdingsRouter.delete("/holdings/:id", async (req, res) => {
  const idParsed = uuidSchema.safeParse(req.params.id);
  if (!idParsed.success) {
    res.status(400).json({ error: "Invalid holding ID" });
    return;
  }
  const [deleted] = await db
    .delete(holdings)
    .where(eq(holdings.id, idParsed.data))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Holding not found" });
    return;
  }
  res.status(204).send();
});
