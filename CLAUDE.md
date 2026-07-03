# Thesis Tracker

AI-powered investment thesis generation and weekly monitoring tool for fund managers.

## Project Status

Phase 3 in progress. A simplification programme is under way (spec 02 done): **the thesis is now a single Markdown document**. The old structured encoding — `thesis_pillars` table, `summary`/`quality_assess`/`valuation`/`assumptions`/`risks` columns, the strict multi-field AI output schema, ~200 lines of pillar CRUD, and the seven per-section frontend editors across five tabs — collapsed into one `theses.content` markdown column. `sources` stays structured (weekly monitoring appends to it; the UI lists it separately). The agent now writes a free-form Markdown thesis (`thesisOutputSchema = { content: string≥200, sources }`); migration `0002_markdown_thesis.sql` backfills `content` for any pre-existing thesis (composes `## Summary` / `## Thesis Pillars` / `## Quality Assessment` / `## Valuation` / `## Key Assumptions` / `## Risks` from the old columns, stripping Tiptap HTML) before dropping them and `weekly_logs.pillar_refs`. Frontend: the five tabs collapse to **Thesis | Weekly Log**; the Thesis tab renders `content` with `react-markdown` + `remark-gfm` and an Edit toggle that swaps in a full-height monospace `<textarea>` on the existing debounced `useAutoSave`, followed by the Sources list and `BrokerResearchPanel` (with `BenchmarkEditor` / `StatusEditor` in the header). `ThesisPrintPage` renders the markdown + sources + weekly log. Deleted the per-section editors (`PillarEditor`, `PillarCard`, `SummaryEditor`, `QualityEditor`, `ValuationEditor`, `AssumptionsEditor`, `RisksEditor`), `SeverityBadge`, and all pillar API/mutations. (Tiptap / `EditableText` remain in the repo but are now unused by the thesis view — spec 03 sweeps rich-text.) 40 integration tests, 68 unit tests, 28 frontend tests — all green.

Prior state (spec 01 — PDF export via browser print view): "Export PDF" opens `/holdings/:id/print` in a new tab, a chrome-free single-scroll render; `ThesisPrintPage` reuses `useThesis`/`useHolding`/`useWeeklyLogs`, calls `window.print()` on mount and shows a visible "Print / Save as PDF" button. Print pagination lives in an `@media print` block + `@page` margins in `web/src/globals.css` (`break-inside: avoid` on sections/rows, weekly-log `thead` set to `table-header-group`). No server-side PDF rendering. `MOCK_AGENT=true` env var flips `ThesisAgent` and `MarketDataService` to fixtures for E2E/demo. Shared test helpers: `src/__tests__/helpers.ts` (`seedHolding`, `seedHoldingWithThesis`, `seedManyHoldings`, `cleanAllTables`). Note: `modelReasoningEffort` still `"low"` for dev (TODO: bump to high for production).

## Key Documents

Read these before making architectural or UX decisions:

- `PRD.md` — Product requirements (v2.1). Pillar-based thesis template, all user stories, acceptance criteria.
- `ARCHITECTURE.md` — Tech architecture (v2.0). Simplified: Codex SDK does web search + file reading natively.
- `SPRINT-PLAN.md` — Phase 1 (5 sprints) + Phase 2 (Sprints 6-9) sprint plans.
- `DESIGN-HANDOFF.md` — Developer-ready component specs, design tokens, interaction states.
- `TESTING-STRATEGY.md` — 6-layer test strategy. Zod schema validation is the critical layer.
- `UX-DESIGN.md` — UX critique, screen-by-screen copy, accessibility notes.
- `DEVILS-ADVOCATE.md` — Risk analysis and stress test of the PRD.
- `TEST-GAPS.md` — Sprint 9 coverage audit. Prioritized gaps for Sprint 10+.

## Tech Stack

- **Backend**: Express 5 + TypeScript 6 on Node.js 20 LTS (Docker) / Node 24 (local)
- **Frontend**: React 19 + Vite 8 + TanStack Table + TanStack Query + Tailwind CSS v4 + Radix UI + react-markdown/remark-gfm (thesis rendering) + Tiptap (legacy `EditableText`, unused by the thesis view — pending removal in spec 03)
- **Database**: PostgreSQL 16 + Drizzle ORM 0.45 (pg driver)
- **Validation**: Zod v4 (env config, API input, AI output)
- **Jobs**: BullMQ + Redis (bulk-generation: concurrency 3, 2 retries; weekly-monitoring: concurrency 10, 3 retries)
- **Scheduling**: node-cron v4 (weekly monitoring cron, configurable via `MONITORING_CRON_SCHEDULE`)
- **Email**: Nodemailer v8 SMTP (optional — configurable via `SMTP_*` env vars, graceful skip when not set)
- **AI**: Codex CLI SDK (`@openai/codex-sdk` + `@openai/codex`) → Azure OpenAI (GPT 5.4-mini, web search live, `runStreamed` for progress events)
- **Market data**: `yahoo-finance2` v3 (weekly price returns for tickers + benchmark indices, no API key needed)
- **File parsing**: ExcelJS (read/write .xlsx + .csv for bulk upload + template generation)
- **Containers**: Docker Compose (api + postgres + redis)
- **Package manager**: pnpm (separate package.json for root backend + web/ frontend)

## Architecture Principles

1. **The Codex agent does the heavy lifting.** Web search, file reading (broker research PDFs), financial analysis — all handled natively by the agent. No vector store, no document parsing pipeline, no search provider abstraction.
2. **Broker research = save file, pass path to agent.** PDFs/DOCX saved to `/data/documents/{holdingId}/`. The agent reads them directly via its built-in PDF skill.
3. **No provider abstraction in v1.** A thin `ThesisAgent` wrapper class isolates the SDK from business logic. That's enough. Extract an interface when a second provider is actually needed.
4. **The thesis is a single Markdown document** (`theses.content`). The agent writes it freely, the manager edits it as raw markdown, and it renders with `react-markdown`. There is no structured pillar/valuation/risk schema — only `content` + a structured `sources` list.
5. **Weekly logs are append-only structured rows.** They reference the thesis *in prose* (the AI summary names the parts affected); there is no pillar-reference column.
6. **Generation progress uses `runStreamed()`.** Real SDK events (web searches, agent_message start) are forwarded via SSE to the frontend. The Codex exec JSONL stream does NOT emit reasoning items — the `ReasoningItem` type exists in the SDK but is never sent. Don't attempt `model_reasoning_summary` config; it has no effect in exec mode.
7. **`@openai/codex` must be a direct dependency** (not just transitive via `@openai/codex-sdk`). pnpm's strict hoisting prevents the SDK's `require.resolve()` chain from finding the platform-specific binary otherwise. This affects Docker builds.

## Running Locally

```bash
docker compose up --build -d   # Start api + postgres + redis
pnpm db:migrate                # Create tables
pnpm db:seed                   # Insert 3 sample holdings
cd web && pnpm dev             # Start frontend at http://localhost:5173
```

API: http://localhost:3001, Frontend: http://localhost:5173 (proxies /api to Express).

Note: Redis is mapped to host port 6380 (not 6379) to avoid conflicts with other containers.

## Running Tests

```bash
pnpm test                      # Backend unit tests (68 tests, no Docker needed)
pnpm test:integration          # Backend integration tests (40 tests, needs Docker for Testcontainers)
cd web && pnpm test            # Frontend component tests (28 tests, no Docker needed)
pnpm test:e2e                  # E2E Playwright tests (9 tests, needs Docker + dev servers)
```

`MOCK_AGENT=true` env var — makes `ThesisAgent` and `MarketDataService` return fixture data instead of calling real APIs. Used by E2E tests (set in `playwright.config.ts`) and useful for local demo/development.

## Project Structure

```
thesis-tracking/
  docker-compose.yml
  Dockerfile                   — Multi-stage: dev (tsx watch) + builder + runner
  .env.example
  package.json                 — Backend deps + scripts (dev, build, db:*)
  tsconfig.json
  drizzle.config.ts
  vitest.integration.config.ts — Integration test config (fileParallelism: false, Testcontainers globalSetup)
  playwright.config.ts         — E2E config (Chromium, MOCK_AGENT=true, webServer auto-start)
  e2e/
    thesis-lifecycle.spec.ts   — Dashboard, modal, thesis detail smoke tests
    bulk-upload.spec.ts        — Bulk upload UI smoke test
    monitoring-flow.spec.ts    — Full monitoring cycle: trigger → log → dashboard update
  src/
    server.ts                  — Express server entry point
    app.ts                     — Express app factory (testable without listen)
    config.ts                  — Zod-validated env parsing (incl. OpenAI/Azure keys, monitoring schedule/concurrency)
    progress.ts                — EventEmitter singleton for SSE progress events
    routes/
      holdings.ts              — Holdings CRUD (GET/POST/PUT/DELETE)
      generation.ts            — POST /api/holdings/:id/generate + GET /api/holdings/:id/progress (SSE)
      theses.ts                — GET thesis + PATCH thesis content (weekly-logs endpoints live here too)
      documents.ts             — POST/GET/DELETE /api/holdings/:id/documents
      bulk.ts                  — Bulk upload: parse/preview, start, SSE progress, cancel, retry, template
      monitoring.ts            — Batch monitoring: POST trigger, GET status, GET progress (SSE), GET history
    agent/
      codex-agent.ts           — ThesisAgent: generateThesis() + analyseWeekly() wrapping @openai/codex-sdk
      prompts.ts               — buildGenerationPrompt() + buildWeeklyPrompt() + input interfaces
      schemas.ts               — Zod schemas for AI output (markdown thesis { content, sources }, weekly log, source)
    services/
      thesis-generation.ts     — Orchestrates: validate → agent call → persist in transaction
      weekly-monitoring.ts     — Weekly monitoring: market data → agent analysis → persist log + update holding + getCurrentWeek() export
      email.ts                — EmailService: Nodemailer SMTP digest after batch monitoring completes
      email-template.ts       — Pure function buildDigestHtml(): inline-CSS HTML email template
      market-data.ts           — yahoo-finance2 wrapper: weekly returns for tickers + benchmark indices
      bulk-generation.ts       — Bulk orchestration: parse → cache rows in Redis → create holdings → enqueue
      file-parser.ts           — ExcelJS .xlsx/.csv parsing + Zod per-row validation
      template-generator.ts    — Generate downloadable .xlsx template with ExcelJS
    jobs/
      queue.ts                 — BullMQ queues (bulk-generation + weekly-monitoring) + Redis connection + batch helpers
      bulk-worker.ts           — Worker (concurrency 3): generates theses, tracks batch state in Redis
      weekly-worker.ts         — Worker (concurrency 10): weekly monitoring per holding, batch progress in Redis
      scheduler.ts             — node-cron scheduler + runMonitoringBatch() (shared by cron + manual trigger)
    __tests__/
      setup-integration.ts     — Global setup: Testcontainers (Postgres 16 + Redis 7), migration runner
      helpers.ts               — Shared test helpers: seedHolding, seedHoldingWithThesis, seedManyHoldings, cleanAllTables
    db/
      schema.ts                — 4 tables (holdings, theses, weekly_logs, documents) + 3 enums + relations
      index.ts                 — Drizzle client
      seed.ts                  — Idempotent seed (3 holdings)
      migrations/              — Drizzle-generated SQL
  web/
    package.json               — Frontend deps
    vite.config.ts             — React + Tailwind plugins, /api proxy
    vitest.config.ts           — Frontend test config (jsdom)
    tsconfig.json
    index.html
    src/
      main.tsx                 — Entry point, QueryClientProvider, BrowserRouter
      App.tsx                  — React Router routes (Dashboard + ThesisDetailPage + ThesisPrintPage)
      globals.css              — Tailwind v4 @theme tokens (brand, accent, status colours) + @media print / @page rules for the print view
      pages/
        Dashboard.tsx           — Holdings list with search, filter chips, loading/empty/error states
        ThesisDetailPage.tsx    — Thesis view: header + 2-tab Radix Tabs (Thesis | Weekly Log)
        ThesisPrintPage.tsx     — Chrome-free single-scroll print/export view; auto-calls window.print() on load
      components/
        Layout.tsx              — Shared header + Outlet + modals + toasts + bulk + monitoring state management
        HoldingsTable.tsx       — TanStack Table, 7 columns, sorting, globalFilterFn, row click, delete
        SearchBar.tsx           — Search input with Cmd+K shortcut, clear button, focus states
        FilterChips.tsx         — All/Long/Short/Strengthened/Weakened/Unchanged/Active/Closed/Paused toggle chips
        AddHoldingModal.tsx     — Radix Dialog: ticker, direction, benchmark, bullets, file upload
        BulkUploadModal.tsx     — Multi-step: file drop → validation preview table → generate
        BulkValidationTable.tsx — TanStack Table preview with inline editing for error rows
        BulkProgressBanner.tsx  — Reusable progress banner with ETA, optional cancel + label (bulk + monitoring)
        BulkResultsModal.tsx    — Post-completion: failure table with per-row retry
        GenerationProgress.tsx  — Live activity feed (SSE-driven): web search queries + "Compiling thesis..." step
        MonitoringHistory.tsx    — Past monitoring batch runs table (week, counts, impact breakdown)
        ErrorFallback.tsx       — React error boundary fallback UI
        FileDropZone.tsx        — Configurable drag-and-drop upload zone (PDF/DOCX or XLSX/CSV)
        EditableText.tsx        — Click-to-edit Tiptap/input (legacy, unused by thesis view — pending removal in spec 03)
        ConfirmDialog.tsx       — Reusable Radix AlertDialog wrapper
        Toast.tsx               — Toast notification container
        StatusBadge.tsx         — Strengthened/Weakened/Unchanged/Generating/New/Failed badges
        DirectionBadge.tsx      — Long/Short badges
        LoadingSkeleton.tsx     — 8-row pulsing skeleton
        EmptyState.tsx          — "No holdings yet" with Add Holding + Upload Spreadsheet buttons
        thesis/
          ThesisContentEditor.tsx — Renders thesis markdown (react-markdown) with an Edit toggle → textarea + autosave
          SourcesList.tsx       — Read-only web sources list
          BrokerResearchPanel.tsx — File list + upload drop zone + delete
          BenchmarkEditor.tsx   — Benchmark index Radix Select dropdown
          StatusEditor.tsx      — Holding status (active/closed/paused) Radix Select
          WeeklyLogTable.tsx    — TanStack Table for weekly logs (empty state when no data)
      hooks/
        useHoldings.ts          — TanStack Query: useHoldings, useCreateHolding, useDeleteHolding
        useThesis.ts            — useThesis + useHolding query hooks
        useThesisMutations.ts   — updateThesis (content)
        useDocuments.ts         — useDocuments, useUploadDocument, useDeleteDocument
        useAutoSave.ts          — Debounced save with status tracking
        useGenerateThesis.ts    — Mutation: create holding → upload files
        useGenerationProgress.ts — SSE progress: live activity log from runStreamed events
        useWeeklyLogs.ts        — TanStack Query: weekly logs for a holding
        useWeeklyMonitoring.ts  — Mutation: trigger weekly monitoring for a holding
        useBulkUpload.ts        — TanStack Query mutation for bulk file upload
        useBulkProgress.ts      — SSE subscription for bulk generation progress + ETA
        useBulkRetry.ts         — Mutation for retrying failed bulk holdings
        useMonitoringProgress.ts — SSE subscription for batch monitoring progress + ETA
        useMonitoringStatus.ts  — TanStack Query: detect active monitoring batch on page load
        useMonitoringHistory.ts — TanStack Query: past batch run summaries
        useToast.ts             — Toast state management
      api/
        client.ts               — Typed fetch: holdings, theses (content), documents, generation, monitoring
        bulk.ts                 — Bulk API: upload, start, cancel, retry, template download
```

## UX Constraints

- Users are **non-technical fund managers**. UX must be dead simple.
- No software jargon. Speak finance: "holdings", "thesis", "weekly update", "broker research".
- Dashboard-first. One button: "Add Holding."
- Thesis view uses two **tabs**: Thesis | Weekly Log. The Thesis tab shows the rendered markdown document (sources + broker research below it).
- The thesis is edited as **one markdown document** — an Edit toggle swaps the rendered view for a full-height textarea with debounced auto-save. No structured per-section editors.

## Design Tokens

Defined in `web/src/globals.css` via Tailwind v4 `@theme` blocks. Use token class names, never raw hex values.

- **Font**: Inter (UI, `font-sans`), JetBrains Mono (numbers/prices, `font-mono`)
- **Brand**: `brand-900` (#0F172A) through `brand-50` (#F8FAFC) — text, borders, backgrounds
- **Accent**: `accent-600` (#2563EB) / `accent-700` (#1D4ED8) — buttons, links
- **Status**: `status-green-*` (strengthened), `status-red-*` (weakened), `status-grey-*` (unchanged), `status-blue-*` (generating)
- **Full token spec in** `DESIGN-HANDOFF.md`

## Sprint Plan

| Sprint | Phase | Week | Focus | Status |
|--------|-------|------|-------|--------|
| S1 | 1 | Apr 14-18 | Foundation — Docker, DB schema, Express + React scaffold, dashboard shell | Done |
| S2 | 1 | Apr 21-25 | AI agent + single thesis generation end-to-end | Done |
| S3 | 1 | Apr 28-May 1 | Thesis view + editing + broker research upload | Done |
| S4 | 1 | May 5-9 | Dashboard polish (search/filter/badges) + bulk upload | Done |
| S5 | 1 | May 12-16 | Integration testing + ship prep + runStreamed migration | Done |
| S6 | 2 | May 19-23 | Weekly monitoring vertical slice — market data + AI analysis + manual trigger | Done |
| S7 | 2 | May 26-30 | Scheduled batch monitoring — node-cron + BullMQ + dashboard | Done |
| S8 | 2 | Jun 2-6 | Email digest + polish | Done |
| S9 | 2 | Jun 9-13 | Test hardening + Phase 3 prep | Done |
| S10 | 3 | Jun 16-20 | PDF export via browser print view (`/holdings/:id/print`) | Done |

## Git Workflow

- **Commit after completing each sprint.** One commit per sprint with a summary of what was built.
- **Commit again after any post-sprint iterations** (bug fixes, architecture changes like WS→SSE). Separate commit from the sprint commit so the history shows what was planned vs. what was fixed.
- Commit messages should summarize the "what" and "why", not list every file changed.

## Planning Requirements

When creating a sprint plan or implementation plan, **always search for the latest documentation** for every technology being used. This is critical because:
- Library APIs change between versions (e.g., Zod v3 → v4, React Router v6 → v7)
- The plan must reference correct, current APIs — not stale knowledge
- Incorrect API usage from outdated docs causes implementation bugs

**Process:**
1. Identify every library/framework touched by the sprint
2. Web search for latest docs for each (use current year in queries)
3. Fetch key doc pages (setup guides, API references) for implementation-critical details
4. Save doc URLs and key API snippets in the plan under a "Documentation References" section
5. During implementation, consult these docs — not memory — for API signatures and patterns

## Code Conventions

- TypeScript strict mode throughout (backend: NodeNext modules, frontend: bundler resolution)
- ESM (`"type": "module"`) — use `.js` extensions in backend imports (e.g., `./config.js`)
- Drizzle ORM for all DB queries — no raw SQL
- Zod schemas for all API input validation and AI output validation
- Prompts live in `src/agent/prompts.ts`, not inline
- Auto-save on frontend edits (debounced, no save button)
- Use Radix UI primitives for accessibility — don't build custom dropdowns/modals/dialogs
- TanStack Query for all data fetching — mutations invalidate `["holdings"]` query key
- Tailwind v4 CSS-first config — tokens in `@theme` blocks in `globals.css`, not `tailwind.config.ts`
- Status badges always include text labels (never colour-only) for accessibility
