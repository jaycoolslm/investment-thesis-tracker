# Spec 07 — Small cuts: email digest, source types, denormalised holding columns

<!--
  Simplification programme — spec 7 of 7 (final). Assumes all earlier specs landed.
  Three independent small removals bundled into one pass.
-->

## Context

Three leftovers from the audit: (a) the SMTP email digest — optional, never
configured in any environment, ~240 lines + a dependency; (b) `sources` entries
carry a decorative `type` enum (`web|broker_research|filing|news`) nobody filters
on; (c) `holdings.latest_impact` / `holdings.last_updated` are denormalised copies
of the latest weekly log, kept in sync by hand in the monitoring service — an
invariant we can stop maintaining by deriving them in the dashboard query.

## Existing implementation & what changes

### A — Remove the email digest

**Remove completely:** `src/services/email.ts`, `src/services/email-template.ts`,
their tests, the digest trigger on monitoring-batch completion, `nodemailer` +
`@types/nodemailer` (`pnpm remove`), and every `SMTP_*` / email env var from
`src/config.ts` and `.env.example`. Update `CLAUDE.md` (Tech Stack, structure,
Sprint 8 status wording can note the digest was later removed).

### B — Sources lose the `type` field

**Change:** `sourceSchema` in `src/agent/schemas.ts` becomes `{ title:
z.string().min(1), url: z.string().nullable() }`. Generation + weekly prompts stop
asking for a source type. `SourcesList` renders title + link only (it must tolerate
legacy stored entries that still carry `type` — read-side tolerance, no migration
needed for JSONB). Update MOCK_AGENT fixtures.

### C — Derive `latestImpact` / `lastUpdated` from weekly logs

**Change:**
- Drop `latest_impact` and `last_updated` columns from `holdings` (schema +
  migration; no backfill needed — the data lives in `weekly_logs`).
- `GET /api/holdings` computes them per holding from the most recent weekly log
  (single query — a lateral join / `DISTINCT ON` subquery via Drizzle; the existing
  `sql` template escape hatch used by `/monitoring/history` is acceptable if
  Drizzle's query builder can't express it cleanly). Response shape to the frontend
  is UNCHANGED (`latestImpact`, `lastUpdated` still present in the JSON) so the
  dashboard, badges, filter chips, and sorting keep working untouched.
- `weekly-monitoring.ts`: delete the code that wrote those holding columns.
- Generation-time status flags (e.g. "Generating"/"New"/"Failed" badges) must be
  unaffected — they derive from thesis existence / generation progress, not these
  columns; verify, don't assume.

**Keep:** everything else. Dashboard behaviour must be pixel-for-pixel equivalent.

## Acceptance criteria

1. `grep -ri "nodemailer\|smtp\|digest" src/ web/src/ package.json .env.example
   CLAUDE.md README.md docker-compose.yml` returns nothing (allow a historical
   "digest removed" note in CLAUDE.md's status section).
2. `grep -rn "broker_research\|'filing'\|\"filing\"" src/ web/src/` shows no source
   `type` machinery; a thesis generated with mock data lists sources as title+link;
   a legacy thesis whose stored sources include `type` still renders (tolerance
   test).
3. Schema: `holdings` has no `latest_impact`/`last_updated`; migration runs on a DB
   with existing holdings + weekly logs; afterwards `GET /api/holdings` returns the
   same `latestImpact`/`lastUpdated` values the latest weekly log implies —
   integration test asserts equality for a seeded holding with 2+ logs across
   different weeks.
4. Dashboard: impact filter chips and the last-updated column still work against
   the derived values (e2e or component test).
5. Monitoring completion no longer references email anywhere; batch completion
   still marks state complete exactly once (regression-check the spec-04 unit test
   still passes).
6. All four suites green; net LOC down; `holdings` list endpoint stays a single
   round-trip (no N+1 per holding — verify the query, not just the output).

## Out of scope

- Re-adding any notification mechanism.
- Any dashboard visual change.
