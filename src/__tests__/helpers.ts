import { db } from "../db/index.js";
import { holdings, theses, weeklyLogs, documents } from "../db/schema.js";

const SAMPLE_CONTENT = `## Summary

A durable compounder with a widening moat and disciplined capital allocation.

## Thesis Pillars

### Growth Thesis

Revenue expanding at a double-digit clip with margin leverage.

## Risks

- **Medium:** Competition intensifies in the core market.`;

/** Create a single holding via direct DB insert. */
export async function seedHolding(
  overrides: Partial<{
    ticker: string;
    companyName: string;
    direction: "long" | "short";
    status: "active" | "closed" | "paused";
    benchmark: string;
  }> = {},
) {
  const [holding] = await db
    .insert(holdings)
    .values({
      ticker: overrides.ticker ?? "AAPL",
      companyName: overrides.companyName ?? "Apple Inc.",
      direction: overrides.direction ?? "long",
      benchmark: overrides.benchmark ?? "S&P 500",
      status: overrides.status ?? "active",
    })
    .returning();
  return holding;
}

/** Create a holding with a markdown thesis via direct DB insert. */
export async function seedHoldingWithThesis(
  overrides: Partial<{
    ticker: string;
    companyName: string;
    direction: "long" | "short";
    status: "active" | "closed" | "paused";
  }> = {},
) {
  const holding = await seedHolding(overrides);

  const [thesis] = await db
    .insert(theses)
    .values({
      holdingId: holding.id,
      content: `# Thesis for ${holding.ticker}\n\n${SAMPLE_CONTENT}`,
    })
    .returning();

  return { holding, thesis };
}

/**
 * Batch-create N holdings with theses in a single transaction.
 * Returns arrays of holding and thesis records.
 */
export async function seedManyHoldings(count: number) {
  return await db.transaction(async (tx) => {
    const holdingRows = await tx
      .insert(holdings)
      .values(
        Array.from({ length: count }, (_, i) => ({
          ticker: `TST${String(i).padStart(3, "0")}`,
          companyName: `Test Company ${i}`,
          direction: (i % 2 === 0 ? "long" : "short") as "long" | "short",
        })),
      )
      .returning();

    const thesisRows = await tx
      .insert(theses)
      .values(
        holdingRows.map((h) => ({
          holdingId: h.id,
          content: `## Summary\n\nThesis for ${h.ticker}.`,
        })),
      )
      .returning();

    return { holdings: holdingRows, theses: thesisRows };
  });
}

/** Delete all data from all tables in FK-safe order. */
export async function cleanAllTables() {
  await db.delete(documents);
  await db.delete(weeklyLogs);
  await db.delete(theses);
  await db.delete(holdings);
}
