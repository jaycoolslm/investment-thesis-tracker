import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Verifies the 0002 markdown-thesis migration against a database that already
// holds old-shape data (structured thesis columns + thesis_pillars +
// weekly_logs.pillar_refs). The global Testcontainers setup has already run all
// migrations on the main test DB, so this suite builds a scratch database on the
// same Postgres server, applies 0000+0001, seeds old-shape rows via raw SQL,
// then applies 0002 and asserts the backfilled `content`.

const MIGRATIONS_DIR = resolve(import.meta.dirname, "../migrations");
const SCRATCH_DB = "migration_backfill_test";

function migrationStatements(file: string): string[] {
  return readFileSync(resolve(MIGRATIONS_DIR, file), "utf-8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function applyMigration(client: pg.Client, file: string) {
  for (const stmt of migrationStatements(file)) {
    await client.query(stmt);
  }
}

let admin: pg.Client;
let scratch: pg.Client;
let content: string;
let emptyContent: string;

beforeAll(async () => {
  admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);

  const scratchUrl = new URL(process.env.DATABASE_URL!);
  scratchUrl.pathname = `/${SCRATCH_DB}`;
  scratch = new pg.Client({ connectionString: scratchUrl.toString() });
  await scratch.connect();

  // Old-shape schema
  await applyMigration(scratch, "0000_eminent_juggernaut.sql");
  await applyMigration(scratch, "0001_robust_speed_demon.sql");

  // Seed an old-shape thesis: legacy rich-text HTML text fields, valuation/assumptions/
  // risks JSONB, two pillars (inserted out of sort order), and a weekly log
  // row carrying pillar_refs.
  const {
    rows: [holding],
  } = await scratch.query(
    `INSERT INTO holdings (ticker, company_name, direction)
     VALUES ('AAPL', 'Apple Inc.', 'long') RETURNING id`,
  );
  const {
    rows: [thesis],
  } = await scratch.query(
    `INSERT INTO theses (holding_id, summary, quality_assess, valuation, assumptions, risks, sources)
     VALUES ($1,
       '<p>Apple is a <strong>quality compounder</strong>.</p><p>Services drive the re-rating.</p>',
       '<p>Wide moat from the iOS ecosystem.</p>',
       '{"methodology": "DCF cross-checked against 25x FY26 EPS.", "currentPrice": "$189.50", "upsideCase": "$260 (+37%)", "baseCase": "$225 (+19%)", "downsideCase": "$150 (-21%)"}'::jsonb,
       '["Services growth stays above 15%", "Gross margin holds above 44%"]'::jsonb,
       '[{"severity": "high", "description": "China demand deteriorates"}, {"severity": "medium", "description": "App Store regulatory pressure"}]'::jsonb,
       '[{"title": "Q2 10-Q", "url": null, "type": "filing"}]'::jsonb)
     RETURNING id`,
    [holding.id],
  );
  await scratch.query(
    `INSERT INTO thesis_pillars (thesis_id, title, body, sort_order) VALUES
       ($1, 'Second Pillar', '<p>Body of the second pillar.</p>', 1),
       ($1, 'First Pillar', '<p>Body of the <em>first</em> pillar.</p>', 0)`,
    [thesis.id],
  );
  await scratch.query(
    `INSERT INTO weekly_logs (holding_id, week_label, thesis_impact, summary, pillar_refs)
     VALUES ($1, '2026-W20', 'strengthened', 'Services beat consensus.', '["First Pillar"]'::jsonb)`,
    [holding.id],
  );

  // A thesis with every structured section empty — the backfill must skip
  // sections, not crash or emit empty headings.
  const {
    rows: [bareHolding],
  } = await scratch.query(
    `INSERT INTO holdings (ticker, company_name, direction)
     VALUES ('TSLA', 'Tesla Inc.', 'short') RETURNING id`,
  );
  await scratch.query(
    `INSERT INTO theses (holding_id, summary) VALUES ($1, '<p></p>')`,
    [bareHolding.id],
  );

  // The migration under test
  await applyMigration(scratch, "0002_markdown_thesis.sql");

  const { rows } = await scratch.query(
    `SELECT t.content FROM theses t JOIN holdings h ON h.id = t.holding_id WHERE h.ticker = 'AAPL'`,
  );
  content = rows[0].content;
  const { rows: bareRows } = await scratch.query(
    `SELECT t.content FROM theses t JOIN holdings h ON h.id = t.holding_id WHERE h.ticker = 'TSLA'`,
  );
  emptyContent = bareRows[0].content;
});

afterAll(async () => {
  await scratch?.end();
  await admin?.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
  await admin?.end();
});

describe("0002_markdown_thesis backfill", () => {
  it("composes a Summary section with legacy HTML stripped", () => {
    expect(content).toContain("## Summary");
    expect(content).toContain("Apple is a quality compounder.");
    expect(content).toContain("Services drive the re-rating.");
    expect(content).not.toMatch(/<[^>]+>/);
  });

  it("includes every pillar title and body in sort order", () => {
    expect(content).toContain("### First Pillar");
    expect(content).toContain("Body of the first pillar.");
    expect(content).toContain("### Second Pillar");
    expect(content).toContain("Body of the second pillar.");
    expect(content.indexOf("### First Pillar")).toBeLessThan(
      content.indexOf("### Second Pillar"),
    );
  });

  it("carries over quality assessment, valuation figures, and assumptions", () => {
    expect(content).toContain("## Quality Assessment");
    expect(content).toContain("Wide moat from the iOS ecosystem.");
    expect(content).toContain("## Valuation");
    expect(content).toContain("DCF cross-checked against 25x FY26 EPS.");
    expect(content).toContain("- **Current price:** $189.50");
    expect(content).toContain("- **Upside case:** $260 (+37%)");
    expect(content).toContain("- **Base case:** $225 (+19%)");
    expect(content).toContain("- **Downside case:** $150 (-21%)");
    expect(content).toContain("## Key Assumptions");
    expect(content).toContain("- Services growth stays above 15%");
    expect(content).toContain("- Gross margin holds above 44%");
  });

  it("renders risks as bullets with severity prefixes", () => {
    expect(content).toContain("## Risks");
    expect(content).toContain("- **High:** China demand deteriorates");
    expect(content).toContain("- **Medium:** App Store regulatory pressure");
  });

  it("skips empty sections instead of emitting bare headings", () => {
    expect(emptyContent).toBe("");
  });

  it("drops the old structure but keeps weekly log rows intact", async () => {
    const { rows: columns } = await scratch.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'theses'`,
    );
    const names = columns.map((c) => c.column_name);
    expect(names).toContain("content");
    for (const dropped of ["summary", "quality_assess", "valuation", "assumptions", "risks"]) {
      expect(names).not.toContain(dropped);
    }

    const { rows: pillarTable } = await scratch.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'thesis_pillars'`,
    );
    expect(pillarTable).toHaveLength(0);

    const { rows: logColumns } = await scratch.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'weekly_logs'`,
    );
    expect(logColumns.map((c) => c.column_name)).not.toContain("pillar_refs");

    const { rows: logs } = await scratch.query(
      `SELECT summary, thesis_impact FROM weekly_logs`,
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].summary).toBe("Services beat consensus.");
    expect(logs[0].thesis_impact).toBe("strengthened");
  });
});
