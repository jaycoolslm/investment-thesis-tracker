# Thesis Tracker

AI-powered investment thesis generation and weekly monitoring tool for fund managers.

## Project Status

Phase 2 Sprint 6 complete. Phase 1 shipped (Sprints 1-5). Sprint 6 (Phase 2 start) added: weekly monitoring vertical slice — `MarketDataService` wrapping `yahoo-finance2` v3 (9 global benchmark indices), `buildWeeklyPrompt()` with pillar-by-pillar analysis and pre-fetched verified price data, `ThesisAgent.analyseWeekly()` implementation (replaced stub), `WeeklyMonitoringService` orchestrator (idempotency via unique DB index, price field overwrite post-parse), `POST /api/holdings/:id/weekly-logs/trigger` + SSE progress endpoint, "Run Weekly Check" button on Weekly Log tab with loading state. Manually tested end-to-end. Integration tests written, deferred to Sprint 9 for validation. Note: `modelReasoningEffort` set to `"low"` for both generation and weekly analysis during dev (TODO: bump to high for production).

## Key Documents

Read these before making architectural or UX decisions:

- `PRD.md` — Product requirements (v2.1). Pillar-based thesis template, all user stories, acceptance criteria.
- `ARCHITECTURE.md` — Tech architecture (v2.0). Simplified: Codex SDK does web search + file reading natively.
- `SPRINT-PLAN.md` — Phase 1 (5 sprints) + Phase 2 (Sprints 6-9) sprint plans.
- `DESIGN-HANDOFF.md` — Developer-ready component specs, design tokens, interaction states.
- `TESTING-STRATEGY.md` — 6-layer test strategy. Zod schema validation is the critical layer.
- `UX-DESIGN.md` — UX critique, screen-by-screen copy, accessibility notes.
- `DEVILS-ADVOCATE.md` — Risk analysis and stress test of the PRD.

## Tech Stack

- **Backend**: Express 5 + TypeScript 6 on Node.js 20 LTS (Docker) / Node 24 (local)
- **Frontend**: React 19 + Vite 8 + TanStack Table + TanStack Query + Tailwind CSS v4 + Radix UI + Tiptap
- **Database**: PostgreSQL 16 + Drizzle ORM 0.45 (pg driver)
- **Validation**: Zod v4 (env config, API input, AI output)
- **Jobs**: BullMQ + Redis (concurrency 3, 2 retry attempts with exponential backoff)
- **AI**: Codex CLI SDK (`@openai/codex-sdk` + `@openai/codex`) → Azure OpenAI (GPT 5.4-mini, web search live, `runStreamed` for progress events)
- **Market data**: `yahoo-finance2` v3 (weekly price returns for tickers + benchmark indices, no API key needed)
- **File parsing**: ExcelJS (read/write .xlsx + .csv for bulk upload + template generation)
- **Containers**: Docker Compose (api + postgres + redis)
- **Package manager**: pnpm (separate package.json for root backend + web/ frontend)

## Architecture Principles

1. **The Codex agent does the heavy lifting.** Web search, file reading (broker research PDFs), financial analysis — all handled natively by the agent. No vector store, no document parsing pipeline, no search provider abstraction.
2. **Broker research = save file, pass path to agent.** PDFs/DOCX saved to `/data/documents/{holdingId}/`. The agent reads them directly via its built-in PDF skill.
3. **No provider abstraction in v1.** A thin `ThesisAgent` wrapper class isolates the SDK from business logic. That's enough. Extract an interface when a second provider is actually needed.
4. **Thesis pillars are first-class DB rows** (not JSONB) so weekly logs can reference them by ID.
5. **Weekly logs are append-only.** `pillar_refs` is JSONB — a snapshot of which pillars were impacted.
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

## Project Structure

```
thesis-tracking/
  docker-compose.yml
  Dockerfile                   — Multi-stage: dev (tsx watch) + builder + runner
  .env.example
  package.json                 — Backend deps + scripts (dev, build, db:*)
  tsconfig.json
  drizzle.config.ts
  src/
    server.ts                  — Express server entry point
    app.ts                     — Express app factory (testable without listen)
    config.ts                  — Zod-validated env parsing (incl. OpenAI/Azure keys)
    progress.ts                — EventEmitter singleton for SSE progress events
    routes/
      holdings.ts              — Holdings CRUD (GET/POST/PUT/DELETE)
      generation.ts            — POST /api/holdings/:id/generate + GET /api/holdings/:id/progress (SSE)
      theses.ts                — GET thesis + PATCH thesis + pillar CRUD + reorder
      documents.ts             — POST/GET/DELETE /api/holdings/:id/documents
      bulk.ts                  — Bulk upload: parse/preview, start, SSE progress, cancel, retry, template
    agent/
      codex-agent.ts           — ThesisAgent: generateThesis() + analyseWeekly() wrapping @openai/codex-sdk
      prompts.ts               — buildGenerationPrompt() + buildWeeklyPrompt() + input interfaces
      schemas.ts               — Zod schemas for AI output (thesis, weekly log, pillars, risks, etc.)
    services/
      thesis-generation.ts     — Orchestrates: validate → agent call → persist in transaction
      weekly-monitoring.ts     — Weekly monitoring: market data → agent analysis → persist log + update holding
      market-data.ts           — yahoo-finance2 wrapper: weekly returns for tickers + benchmark indices
      bulk-generation.ts       — Bulk orchestration: parse → cache rows in Redis → create holdings → enqueue
      file-parser.ts           — ExcelJS .xlsx/.csv parsing + Zod per-row validation
      template-generator.ts    — Generate downloadable .xlsx template with ExcelJS
    jobs/
      queue.ts                 — BullMQ queue + Redis connection + enqueueBatch/cancelBatch helpers
      bulk-worker.ts           — Worker (concurrency 3): generates theses, tracks batch state in Redis
    db/
      schema.ts                — 5 tables + 3 enums + relations
      index.ts                 — Drizzle client
      seed.ts                  — Idempotent seed (3 holdings)
      migrations/              — Drizzle-generated SQL
    jobs/                      — BullMQ queues, workers, scheduler (Sprint 4)
  web/
    package.json               — Frontend deps
    vite.config.ts             — React + Tailwind plugins, /api proxy
    vitest.config.ts           — Frontend test config (jsdom)
    tsconfig.json
    index.html
    src/
      main.tsx                 — Entry point, QueryClientProvider, BrowserRouter
      App.tsx                  — React Router routes (Dashboard + ThesisDetailPage)
      globals.css              — Tailwind v4 @theme tokens (brand, accent, status colours)
      pages/
        Dashboard.tsx           — Holdings list with search, filter chips, loading/empty/error states
        ThesisDetailPage.tsx    — Thesis view: header, 5-tab Radix Tabs, all editors
      components/
        Layout.tsx              — Shared header + Outlet + modals + toasts + bulk state management
        HoldingsTable.tsx       — TanStack Table, 7 columns, sorting, globalFilterFn, row click, delete
        SearchBar.tsx           — Search input with Cmd+K shortcut, clear button, focus states
        FilterChips.tsx         — All/Long/Short/Strengthened/Weakened/Unchanged/Active/Closed/Paused toggle chips
        AddHoldingModal.tsx     — Radix Dialog: ticker, direction, benchmark, bullets, file upload
        BulkUploadModal.tsx     — Multi-step: file drop → validation preview table → generate
        BulkValidationTable.tsx — TanStack Table preview with inline editing for error rows
        BulkProgressBanner.tsx  — Persistent progress bar with ETA and cancel (between header + main)
        BulkResultsModal.tsx    — Post-completion: failure table with per-row retry
        GenerationProgress.tsx  — Live activity feed (SSE-driven): web search queries + "Compiling thesis..." step
        ErrorFallback.tsx       — React error boundary fallback UI
        FileDropZone.tsx        — Configurable drag-and-drop upload zone (PDF/DOCX or XLSX/CSV)
        EditableText.tsx        — Click-to-edit: Tiptap (multiline) or input (singleline), auto-save
        ConfirmDialog.tsx       — Reusable Radix AlertDialog wrapper
        SeverityBadge.tsx       — High/Medium/Low risk badge with editable Select
        Toast.tsx               — Toast notification container
        StatusBadge.tsx         — Strengthened/Weakened/Unchanged/Generating/New/Failed badges
        DirectionBadge.tsx      — Long/Short badges
        LoadingSkeleton.tsx     — 8-row pulsing skeleton
        EmptyState.tsx          — "No holdings yet" with Add Holding + Upload Spreadsheet buttons
        thesis/
          SummaryEditor.tsx     — Thesis summary Tiptap editor
          PillarEditor.tsx      — Pillar list with add/reorder
          PillarCard.tsx        — Single pillar: title + body editing + move + delete
          QualityEditor.tsx     — Quality assessment Tiptap editor
          ValuationEditor.tsx   — Valuation key-value pairs
          AssumptionsEditor.tsx — Editable assumption rows (JSONB array)
          RisksEditor.tsx       — Risk rows with severity dropdown (JSONB array)
          SourcesList.tsx       — Read-only web sources list
          BrokerResearchPanel.tsx — File list + upload drop zone + delete
          BenchmarkEditor.tsx   — Benchmark index Radix Select dropdown
          StatusEditor.tsx      — Holding status (active/closed/paused) Radix Select
          WeeklyLogTable.tsx    — TanStack Table for weekly logs (empty state when no data)
      hooks/
        useHoldings.ts          — TanStack Query: useHoldings, useCreateHolding, useDeleteHolding
        useThesis.ts            — useThesis + useHolding query hooks
        useThesisMutations.ts   — updateThesis, CRUD pillars, reorder
        useDocuments.ts         — useDocuments, useUploadDocument, useDeleteDocument
        useAutoSave.ts          — Debounced save with status tracking
        useGenerateThesis.ts    — Mutation: create holding → upload files
        useGenerationProgress.ts — SSE progress: live activity log from runStreamed events
        useWeeklyLogs.ts        — TanStack Query: weekly logs for a holding
        useWeeklyMonitoring.ts  — Mutation: trigger weekly monitoring for a holding
        useBulkUpload.ts        — TanStack Query mutation for bulk file upload
        useBulkProgress.ts      — SSE subscription for bulk generation progress + ETA
        useBulkRetry.ts         — Mutation for retrying failed bulk holdings
        useToast.ts             — Toast state management
      api/
        client.ts               — Typed fetch: holdings, theses, pillars, documents, generation
        bulk.ts                 — Bulk API: upload, start, cancel, retry, template download
```

## UX Constraints

- Users are **non-technical fund managers**. UX must be dead simple.
- No software jargon. Speak finance: "holdings", "thesis", "weekly update", "broker research".
- Dashboard-first. One button: "Add Holding."
- Thesis view uses **tabs** (not a long scroll): Summary+Pillars | Quality+Valuation | Assumptions+Risks | Sources | Weekly Log.
- Structured items (pillars, assumptions, risks) use **Notion-style block editing** — discrete rows with add/remove/reorder.
- Narrative sections use **click-to-edit** text blocks with auto-save.

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
| S7 | 2 | May 26-30 | Scheduled batch monitoring — node-cron + BullMQ + dashboard | |
| S8 | 2 | Jun 2-6 | Email digest + polish | |
| S9 | 2 | Jun 9-13 | Test hardening + Phase 3 prep | |

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
