import { eq, and } from "drizzle-orm";
import { db } from "./index.js";
import { holdings, theses, weeklyLogs } from "./schema.js";
import { getCurrentWeek } from "../services/weekly-monitoring.js";
import type { Source } from "../agent/schemas.js";

type ThesisImpact = "strengthened" | "weakened" | "unchanged";

interface WeeklyLogSeed {
  /** Weeks in the past (0 = current week, 1 = last week, ...). */
  weeksAgo: number;
  priceChangePct: number;
  indexChangePct: number;
  thesisImpact: ThesisImpact;
  summary: string;
  sources: Source[];
}

interface HoldingSeed {
  ticker: string;
  companyName: string;
  direction: "long" | "short";
  benchmark: string;
  content: string;
  sources: Source[];
  weeklyLogs: WeeklyLogSeed[];
}

const seedHoldings: HoldingSeed[] = [
  {
    ticker: "AAPL",
    companyName: "Apple Inc.",
    direction: "long",
    benchmark: "S&P 500",
    content: `# Apple Inc. (AAPL) — Long

## Summary

We are **long Apple** as a durable compounder whose installed base of over two billion active devices underwrites a fast-growing, high-margin Services franchise. The market continues to value Apple as a hardware vendor while the earnings mix shifts structurally toward recurring, software-like revenue.

## Thesis Pillars

- **Services flywheel** — App Store, iCloud, Apple Music, and advertising now generate gross margins roughly double the hardware business, and they scale with the installed base rather than with unit sales.
- **Pricing power & ecosystem lock-in** — switching costs across iMessage, Health, and Continuity keep churn low and support a premium ASP.
- **Capital return** — consistent buybacks shrink the share count, compounding EPS even in flat-revenue years.

## Catalysts

1. On-device generative AI ("Apple Intelligence") driving an iPhone upgrade cycle.
2. Continued double-digit Services growth re-rating the multiple toward software peers.

## Risks

- **Regulatory:** App Store commission structure under pressure in the EU and US.
- **China:** demand softness and geopolitical exposure in a key market.
- **Hardware cyclicality:** a weak upgrade cycle could mask Services strength near term.`,
    sources: [
      {
        title: "Apple Q4 FY2025 Earnings Press Release",
        url: "https://www.apple.com/newsroom/",
      },
      {
        title: "Apple Inc. 10-K Annual Report (SEC)",
        url: "https://investor.apple.com/sec-filings/",
      },
      { title: "Apple Investor Relations", url: "https://investor.apple.com/" },
    ],
    weeklyLogs: [
      {
        weeksAgo: 1,
        priceChangePct: 2.4,
        indexChangePct: 1.1,
        thesisImpact: "strengthened",
        summary:
          "AAPL outperformed the S&P 500 by 1.3pts after Services revenue guidance came in ahead of consensus, reinforcing the recurring-revenue pillar of the long thesis.",
        sources: [
          {
            title: "Apple beats on Services revenue",
            url: "https://www.reuters.com/technology/",
          },
        ],
      },
      {
        weeksAgo: 0,
        priceChangePct: -0.8,
        indexChangePct: 0.3,
        thesisImpact: "unchanged",
        summary:
          "Modest pullback on broad tech profit-taking; no thesis-relevant news. Slight underperformance versus the index but within normal weekly noise.",
        sources: [
          {
            title: "Tech shares slip in quiet week",
            url: "https://www.bloomberg.com/markets/",
          },
        ],
      },
    ],
  },
  {
    ticker: "TSLA",
    companyName: "Tesla Inc.",
    direction: "short",
    benchmark: "NASDAQ",
    content: `# Tesla Inc. (TSLA) — Short

## Summary

We are **short Tesla** on valuation and deteriorating fundamentals. The stock is priced as though full self-driving and robotaxis are near-certain, while the core auto business is facing margin compression, price cuts, and intensifying EV competition.

## Thesis Pillars

- **Auto margins compressing** — repeated price cuts to defend volume are eroding the automotive gross margin that historically justified the premium.
- **Competition** — legacy OEMs and Chinese manufacturers (notably BYD) are closing the cost and technology gap.
- **Valuation disconnect** — the multiple embeds optionality (FSD, robotaxi, energy, Optimus) that remains unproven and repeatedly delayed.

## Catalysts

1. Continued deceleration in delivery growth versus guidance.
2. Further gross-margin erosion in quarterly results.
3. Slippage in the robotaxi / FSD timeline.

## Risks

- **Squeeze risk:** high retail ownership and narrative momentum can drive violent short-term rallies.
- **Energy storage:** the energy segment is growing quickly and could offset auto weakness.
- **A genuine FSD breakthrough** would invalidate the core of the short.`,
    sources: [
      {
        title: "Tesla Q3 2025 Shareholder Deck",
        url: "https://ir.tesla.com/",
      },
      {
        title: "Tesla Inc. 10-Q Quarterly Filing (SEC)",
        url: "https://www.sec.gov/cgi-bin/browse-edgar",
      },
      { title: "Tesla Investor Relations", url: "https://ir.tesla.com/" },
    ],
    weeklyLogs: [
      {
        weeksAgo: 1,
        priceChangePct: -3.6,
        indexChangePct: 0.9,
        thesisImpact: "strengthened",
        summary:
          "TSLA fell 3.6% while the NASDAQ rose, a 4.5pt relative decline, after another round of price cuts pressured margin expectations — directly supportive of the short thesis on auto-margin compression.",
        sources: [
          {
            title: "Tesla cuts prices again in key markets",
            url: "https://www.cnbc.com/tesla/",
          },
        ],
      },
      {
        weeksAgo: 0,
        priceChangePct: 5.2,
        indexChangePct: 1.4,
        thesisImpact: "weakened",
        summary:
          "Sharp rally on renewed FSD/robotaxi optimism drove TSLA up 5.2% versus a 1.4% index gain. Narrative-driven squeeze pressures the short; fundamentals unchanged but positioning risk is elevated.",
        sources: [
          {
            title: "Tesla jumps on autonomy optimism",
            url: "https://www.bloomberg.com/technology/",
          },
        ],
      },
    ],
  },
  {
    ticker: "SHEL.L",
    companyName: "Shell plc",
    direction: "long",
    benchmark: "FTSE 100",
    content: `# Shell plc (SHEL.L) — Long

## Summary

We are **long Shell** as a cash-generative energy major trading at a persistent discount to US peers despite a disciplined capital framework, a world-class LNG franchise, and a shareholder-return policy that funds large, sustained buybacks.

## Thesis Pillars

- **LNG leadership** — Shell is one of the largest integrated LNG players globally, a structurally advantaged position as gas serves as a transition fuel.
- **Capital discipline** — reduced upstream reinvestment and lower breakevens translate high oil and gas prices into strong free cash flow.
- **Valuation gap** — a wide discount to US majors (Exxon, Chevron) offers scope for re-rating, potentially aided by a US listing debate.

## Catalysts

1. Sustained buyback pace shrinking the share count each quarter.
2. Narrowing of the UK/US valuation discount.
3. Firm LNG demand through the winter.

## Risks

- **Commodity price:** free cash flow is highly sensitive to oil and gas prices.
- **Energy transition:** long-term demand uncertainty and policy/carbon pressure.
- **Capital-allocation drift** into lower-return low-carbon projects.`,
    sources: [
      {
        title: "Shell Q3 2025 Results Announcement",
        url: "https://www.shell.com/investors.html",
      },
      {
        title: "Shell plc Annual Report 2024",
        url: "https://reports.shell.com/",
      },
      {
        title: "Shell Investor Relations",
        url: "https://www.shell.com/investors.html",
      },
    ],
    weeklyLogs: [
      {
        weeksAgo: 1,
        priceChangePct: 1.8,
        indexChangePct: 0.6,
        thesisImpact: "strengthened",
        summary:
          "SHEL.L outperformed the FTSE 100 by 1.2pts as firmer Brent crude and a reaffirmed buyback lifted the shares, supporting the free-cash-flow and capital-return pillars of the long thesis.",
        sources: [
          {
            title: "Shell shares rise on higher oil prices",
            url: "https://www.ft.com/energy",
          },
        ],
      },
      {
        weeksAgo: 0,
        priceChangePct: 0.4,
        indexChangePct: 0.5,
        thesisImpact: "unchanged",
        summary:
          "Broadly in line with the index in a quiet week for energy; no thesis-relevant developments. LNG demand outlook and buyback pace remain intact.",
        sources: [
          {
            title: "European energy majors steady",
            url: "https://www.reuters.com/business/energy/",
          },
        ],
      },
    ],
  },
];

/** Resolve the ISO week label + Monday date for a given number of weeks ago. */
function weekFor(weeksAgo: number): { weekLabel: string; weekDate: string } {
  const d = new Date();
  d.setDate(d.getDate() - weeksAgo * 7);
  const { weekLabel, weekDate } = getCurrentWeek(d);
  return { weekLabel, weekDate };
}

async function seed() {
  console.log("Seeding holdings, theses, and weekly logs...");

  for (const seedRow of seedHoldings) {
    // 1. Find or create the holding (idempotent on ticker).
    let [holding] = await db
      .select()
      .from(holdings)
      .where(eq(holdings.ticker, seedRow.ticker));

    if (!holding) {
      [holding] = await db
        .insert(holdings)
        .values({
          ticker: seedRow.ticker,
          companyName: seedRow.companyName,
          direction: seedRow.direction,
          benchmark: seedRow.benchmark,
        })
        .returning();
    }

    // 2. Ensure a thesis exists (backfill if missing).
    const [existingThesis] = await db
      .select()
      .from(theses)
      .where(eq(theses.holdingId, holding.id));

    if (!existingThesis) {
      await db.insert(theses).values({
        holdingId: holding.id,
        content: seedRow.content,
        sources: seedRow.sources,
      });
    }

    // 3. Ensure each weekly log exists (idempotent on holding + week label).
    for (const logSeed of seedRow.weeklyLogs) {
      const { weekLabel, weekDate } = weekFor(logSeed.weeksAgo);

      const [existingLog] = await db
        .select()
        .from(weeklyLogs)
        .where(
          and(
            eq(weeklyLogs.holdingId, holding.id),
            eq(weeklyLogs.weekLabel, weekLabel),
          ),
        );

      if (!existingLog) {
        const relativePerf =
          Math.round((logSeed.priceChangePct - logSeed.indexChangePct) * 100) /
          100;

        await db.insert(weeklyLogs).values({
          holdingId: holding.id,
          weekLabel,
          weekDate,
          priceChangePct: logSeed.priceChangePct.toString(),
          indexChangePct: logSeed.indexChangePct.toString(),
          relativePerf: relativePerf.toString(),
          thesisImpact: logSeed.thesisImpact,
          summary: logSeed.summary,
          sources: logSeed.sources,
        });
      }
    }
  }

  const holdingRows = await db.select().from(holdings);
  const thesisRows = await db.select().from(theses);
  const logRows = await db.select().from(weeklyLogs);

  console.log(
    `Seeded ${holdingRows.length} holdings, ${thesisRows.length} theses, ${logRows.length} weekly logs:`,
  );
  for (const row of holdingRows) {
    console.log(`  ${row.ticker} — ${row.companyName} (${row.direction})`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
