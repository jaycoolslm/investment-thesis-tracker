# Spec 02 — The thesis becomes one markdown document

<!--
  Simplification programme — spec 2 of 7. Assumes spec 01 (PDF export is now a
  print view) has landed. This is the keystone spec: the opinionated thesis
  structure (pillars table, valuation/assumptions/risks JSONB, per-section editors,
  strict AI output schema) collapses into a single markdown `content` column that
  is rendered, edited as text, and generated freely by the agent.
-->

## Context

Today a thesis is encoded in four layers that must all agree: a strict Zod AI-output
schema (2–5 pillars, valuation cases, severity-rated risks), a `thesis_pillars` table
plus four JSONB columns, ~200 lines of pillar CRUD API, and seven structured frontend
editors across five tabs. The product need is simpler: the agent writes a good
thesis *document*; the manager reads it, edits it, and monitors it weekly. Make the
thesis a single markdown document. Keep `sources` as structured data (weekly
monitoring appends to it and the UI lists it separately).

## Existing implementation & what changes

**Keep (reuse as-is — do NOT touch):**
- `holdings` table and routes; `documents` table and routes; broker-research upload.
- `weekly_logs` table except the `pillar_refs` column (removed below). Weekly logs
  remain append-only structured rows — they power the dashboard and history.
- The `ThesisAgent` wrapper shape (`generateThesis()` / `analyseWeekly()`,
  `runStreamed`, MOCK_AGENT fixtures) — only its output schema and prompts change.
- `sources` JSONB column on `theses` and the `SourcesList` component.
- Generation progress SSE plumbing (spec 05 deals with it — leave as-is here).

**Change — database (`src/db/schema.ts` + migrations):**
- `theses`: add `content: text` (the markdown document). Drop `summary`,
  `qualityAssess`, `valuation`, `assumptions`, `risks`. Drop the `thesis_pillars`
  table. Drop `weekly_logs.pillar_refs`.
- One migration, hand-edited to include a **SQL data backfill** before the drops:
  compose `content` for every existing thesis as markdown —
  `## Summary` (from `summary`), `## Thesis Pillars` (each pillar in `sort_order` as
  `### {title}` + body), `## Quality Assessment`, `## Valuation` (methodology +
  current price + upside/base/downside as bullets from the JSONB), `## Key
  Assumptions` (bullets), `## Risks` (bullets with **High/Medium/Low** prefixes from
  the JSONB). Strip HTML tags from the Tiptap-HTML fields with
  `regexp_replace(col, '<[^>]+>', '', 'g')` (crude is acceptable; convert
  `</p>`/`<br>` to newlines first). Empty/null sections are skipped.
- `pnpm db:migrate` must succeed on a database that already holds pre-change theses
  with pillars, and on a fresh database.

**Change — agent (`src/agent/schemas.ts`, `prompts.ts`, fixtures):**
- `thesisOutputSchema` becomes `{ content: z.string().min(200), sources:
  z.array(sourceSchema).min(1) }`.
- `buildGenerationPrompt`: ask for a well-structured **markdown** investment thesis
  document. Suggest (not mandate) sections: Summary, Thesis Pillars, Quality
  Assessment, Valuation, Key Assumptions, Risks. The agent is free to shape the
  document to the situation. Keep the existing context inputs (ticker, direction,
  bullets, broker-research file paths, web search).
- `weeklyLogOutputSchema`: remove `pillarRefs`. `buildWeeklyPrompt`: pass the thesis
  `content` markdown (instead of structured pillars) as context; the weekly summary
  should mention which parts of the thesis were affected *in prose*.
- Update MOCK_AGENT fixtures for both to the new shapes (markdown content for
  generation; no pillarRefs in weekly output).

**Change — API (`src/routes/theses.ts`, `src/services/thesis-generation.ts`,
`src/services/weekly-monitoring.ts`):**
- `GET /api/holdings/:id/thesis` returns `{ id, holdingId, content, sources,
  createdAt, updatedAt }` — no pillar join.
- `PATCH /api/theses/:id` accepts `{ content?: string }` (Zod: non-empty when
  present) plus nothing else.
- Delete all pillar routes (`POST/PATCH/DELETE /api/theses/:id/pillars*`, reorder).
- `thesis-generation.ts`: persist `{ content, sources }` — no pillar transaction.
- `weekly-monitoring.ts`: stop reading pillars / writing `pillarRefs`.

**Change — frontend:**
- `ThesisDetailPage`: tabs collapse to **Thesis | Weekly Log**. The Thesis tab
  renders `content` as markdown (add `react-markdown` to `web/`; no plugins beyond
  `remark-gfm` if tables need it), followed by the existing Sources list and the
  existing `BrokerResearchPanel`, `BenchmarkEditor`, `StatusEditor` where they
  currently live.
- Editing: an "Edit" toggle swaps the rendered markdown for a full-height
  `<textarea>` (monospace, the raw markdown), with the existing debounced
  `useAutoSave` pattern and a rendered/editing toggle. No new editor library.
- Delete: `PillarEditor`, `PillarCard`, `QualityEditor`, `ValuationEditor`,
  `AssumptionsEditor`, `RisksEditor`, `SummaryEditor`, `SeverityBadge` (if now
  unused), `useThesisMutations` pillar mutations, and their tests. Update
  `WeeklyLogTable` to drop the pillar-chips column.
- `ThesisPrintPage` (from spec 01): render the markdown + sources + weekly log.
- `web/src/api/client.ts` and hooks: thesis type becomes `{ content, sources, … }`;
  pillar API functions deleted.

**Change — docs:** `CLAUDE.md` (Architecture Principles 4 and 5 rewrite: pillars are
gone, weekly logs reference the thesis in prose; Project Structure; status), and
`README.md` if it mentions pillars/tabs.

## Acceptance criteria

1. `grep -ri "pillar" src/ web/src/ e2e/ CLAUDE.md README.md` returns nothing
   (except, if unavoidable, the migration SQL that drops/backfills the old table).
2. The migration, run against a DB seeded with an old-shape thesis (2+ pillars,
   valuation/assumptions/risks JSONB, Tiptap-HTML summary), produces a `content`
   markdown document containing every pillar title and body, valuation figures,
   assumptions, and risks with severities — verified by an integration test that
   inserts old-shape rows via raw SQL *before* running the final migration, or by a
   documented manual check if Testcontainers migration ordering makes that
   impractical (state which in the build log; silent data loss is a gate failure).
3. Generating a thesis with `MOCK_AGENT=true` produces a thesis whose `content`
   renders as formatted markdown on the Thesis tab (headings visible as headings —
   never raw `##` shown to the user).
4. Editing: toggling to edit shows the raw markdown in a textarea; typing autosaves
   (debounced); toggling back shows the updated rendering; reload persists it.
5. Weekly monitoring (mock) still produces a weekly log row with impact + summary and
   updates the dashboard badge; no `pillar_refs` anywhere in schema or payloads.
6. The five-tab layout is gone; Thesis and Weekly Log tabs both render with
   loading/empty/error states intact.
7. All four suites green; e2e specs updated for the new tab structure and pass.
8. Net diff for this spec removes ≥ 800 lines (sanity check that the editors and
   pillar CRUD actually died).

## Out of scope

- Removing Tiptap/EditableText from the repo (spec 03 sweeps rich-text; here you only
  must stop *using* them for thesis sections).
- SSE/polling changes (spec 05). Bulk upload flow (spec 06).
