import { eq } from "drizzle-orm";
import { db } from "./index.js";
import { holdings } from "./schema.js";

const seedHoldings = [
  {
    ticker: "AAPL",
    companyName: "Apple Inc.",
    direction: "long" as const,
    benchmark: "S&P 500",
  },
  {
    ticker: "TSLA",
    companyName: "Tesla Inc.",
    direction: "short" as const,
    benchmark: "NASDAQ",
  },
  {
    ticker: "SHEL.L",
    companyName: "Shell plc",
    direction: "long" as const,
    benchmark: "FTSE 100",
  },
];

async function seed() {
  console.log("Seeding holdings...");

  for (const holding of seedHoldings) {
    const existing = await db
      .select()
      .from(holdings)
      .where(eq(holdings.ticker, holding.ticker));
    if (existing.length === 0) {
      await db.insert(holdings).values(holding);
    }
  }

  const rows = await db.select().from(holdings);
  console.log(`Seeded ${rows.length} holdings:`);
  for (const row of rows) {
    console.log(`  ${row.ticker} — ${row.companyName} (${row.direction})`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
