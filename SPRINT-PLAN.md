# Thesis Tracker — Sprint Plan

**Phase 1**: Thesis Generation + Research Upload (complete)
**Phase 2**: Weekly Monitoring + Email Digest

---

# Phase 1 — Thesis Generation + Research Upload

**Phase**: 1 — Thesis Generation + Research Upload
**Duration**: 5 weeks (5 x 1-week sprints)
**Team**: Single developer with AI-assisted coding
**Start date**: 2026-04-14

---

## Effort Key

| Size | Meaning | Rough hours |
|------|---------|-------------|
| S | Straightforward, well-defined | 1–3 hrs |
| M | Some moving parts, needs thought | 3–6 hrs |
| L | Multiple components, integration work | 6–12 hrs |

---

## Sprint 1 — Foundation + Skeleton (Apr 14–18)

**Goal**: Standing app with Docker, database, API shell, and a rendered (empty) dashboard. Developer can `docker compose up` and see a page.

| # | Task | Req | Size | Notes |
|---|------|-----|------|-------|
| 1.1 | Docker Compose: `api`, `postgres`, `redis` containers | — | M | Multi-stage Dockerfile, hot-reload for dev |
| 1.2 | Express.js + TypeScript scaffold with config/env validation | — | S | `src/server.ts`, `src/config.ts`, `.env.example` |
| 1.3 | Drizzle ORM setup + initial schema: `holdings`, `theses`, `thesis_pillars`, `weekly_logs`, `documents` | — | M | Tables per ARCHITECTURE.md data model |
| 1.4 | Run first migration, seed script with 2–3 dummy holdings | — | S | Validates full DB pipeline |
| 1.5 | React 19 + Vite + Tailwind + Radix scaffold (`web/`) | — | M | Proxy API requests to Express in dev |
| 1.6 | Holdings API: `GET /api/holdings`, `POST /api/holdings`, `GET /api/holdings/:id`, `DELETE /api/holdings/:id` | R5 | M | CRUD with Drizzle queries |
| 1.7 | Typed API client (`web/src/api/client.ts`) + `useHoldings` hook | R5 | S | Fetch + SWR or TanStack Query |
| 1.8 | Dashboard page shell: TanStack Table rendering holdings from API | R5 | M | Columns: ticker, company, direction, status, dates |

**Sprint 1 deliverable**: `docker compose up` boots the full stack. Dashboard renders holdings from Postgres. CRUD works via API.

---

## Sprint 2 — AI Agent + Single Thesis Generation (Apr 21–25)

**Goal**: User fills out the Add Holding form, clicks generate, and gets a full pillar-based thesis back from the Codex agent.

| # | Task | Req | Size | Notes |
|---|------|-----|------|-------|
| 2.1 | ThesisAgent wrapper class (`src/agent/codex-agent.ts`) | R7 | M | `generateThesis()` method, Codex SDK thread lifecycle |
| 2.2 | Prompt templates (`src/agent/prompts.ts`) + JSON output schemas (`src/agent/schemas.ts`) | R3, R7 | M | Pillar-based template: summary, pillars, quality, valuation, assumptions, risks, sources |
| 2.3 | Thesis generation service (`src/services/thesis-generation.ts`) | R1 | M | Orchestrates: create holding → call agent → parse response → persist thesis + pillars |
| 2.4 | Generation API: `POST /api/holdings/:id/generate` | R1 | S | Calls generation service, returns thesis |
| 2.5 | SSE progress endpoint (`GET /api/holdings/:id/progress`) | R1 | M | Server emits step events via EventEmitter + SSE stream; client connects with EventSource |
| 2.6 | Add Holding form: ticker, direction, benchmark dropdown, bullet textarea, file upload zone | R1, R11 | M | Radix Select for benchmark (S&P 500, NASDAQ, FTSE 100, Euro Stoxx 50, Nikkei 225, Hang Seng, ASX 200) |
| 2.7 | Multi-step progress indicator on form submission | R1 | S | "Searching for market data..." → "Analysing broker research..." → "Building thesis pillars..." → "Compiling document..." via SSE |
| 2.8 | Error handling: generation failure → clear message + retry button | R1 | S | Toast + inline retry on form |
| 2.9 | Parse and persist thesis response: thesis row + pillar rows + sources | R3 | M | Map agent JSON output to Drizzle inserts |

**Sprint 2 deliverable**: End-to-end single thesis generation. User enters ticker + bullets, sees progress steps, gets a structured thesis stored in DB. Benchmark is selectable.

**Critical path note**: Tasks 2.1–2.3 are the core dependency. Everything else flows from a working agent.

---

## Sprint 3 — Thesis View + Editing + Broker Research (Apr 28–May 1)

**Goal**: User can view, navigate, and edit a generated thesis. User can upload broker research before or after generation.

| # | Task | Req | Size | Notes |
|---|------|-----|------|-------|
| 3.1 | Thesis detail page with tab navigation | R6 | M | Tabs: Summary+Pillars, Quality+Valuation, Assumptions+Risks, Sources, Weekly Log |
| 3.2 | Summary narrative: Tiptap click-to-edit block | R6 | M | Tiptap editor with auto-save (debounced PUT to `/api/theses/:id`) |
| 3.3 | Pillar editor: Notion-style block editing | R6 | L | Add/remove/reorder pillars. Each pillar: editable title + body. Drag handle for reorder. `PUT /api/theses/:id/pillars/:pid`, `POST /api/theses/:id/pillars`, `DELETE` |
| 3.4 | Assumptions + Risks editors: discrete editable rows | R6 | M | Assumptions: add/remove/edit text rows. Risks: add/remove/edit with severity dropdown (High/Med/Low). Stored as JSONB, auto-save |
| 3.5 | Quality assessment + valuation display with click-to-edit | R6 | S | Simpler sections, fewer moving parts |
| 3.6 | Sources section (read-only list from generation) | R6 | S | Render sources array, link out where possible |
| 3.7 | Document upload API: `POST /api/holdings/:id/documents`, `GET`, `DELETE` | R9 | M | Multer for file handling, save to `/data/documents/{holdingId}/`, metadata to DB |
| 3.8 | Drag-and-drop document upload UI | R9 | M | Radix + custom drop zone. File type/size validation (PDF/DOCX, 50MB). Show uploaded docs list with delete |
| 3.9 | Wire uploaded docs into thesis generation: pass file paths to agent prompt | R9 | S | Update generation service to query documents table and include paths |
| 3.10 | Benchmark display in thesis header + editable via dropdown | R11 | S | Show "Benchmark: S&P 500" in header, click to change, auto-save |

**Sprint 3 deliverable**: Full thesis view with tabbed navigation. All sections editable with auto-save. Broker research upload works and feeds into generation. Benchmark editable post-generation.

**Parallelisable**: 3.7–3.8 (document upload backend+frontend) can be built independently from 3.1–3.6 (thesis view+editing).

---

## Sprint 4 — Dashboard Polish + Bulk Upload (May 5–9)

**Goal**: Dashboard is fully functional with search/filter/sort. Bulk spreadsheet upload generates theses for an entire portfolio.

| # | Task | Req | Size | Notes |
|---|------|-----|------|-------|
| 4.1 | Dashboard: sortable columns on all fields | R5 | S | TanStack Table sorting config |
| 4.2 | Dashboard: real-time search/filter bar (ticker + company name) | R5 | M | Filter as-you-type. Filter chips for direction (Long/Short) and status |
| 4.3 | Dashboard: Cmd+K (or /) keyboard shortcut to focus search | R5 | S | Global keydown listener |
| 4.4 | Dashboard: colour-coded status badges | R5 | S | Green = strengthened, Red = weakened, Grey = unchanged/new |
| 4.5 | Dashboard: click row → navigate to thesis detail | R5 | S | React Router link |
| 4.6 | BullMQ queue setup (`src/jobs/queue.ts`) + bulk generation worker | R2 | M | Queue: `bulk-generation`. Worker processes one holding at a time. Configurable concurrency |
| 4.7 | Bulk upload API: `POST /api/bulk-generate` (xlsx/csv parse + validate) | R2 | M | Use `xlsx` or `exceljs` for parsing. Validate columns: Ticker, Direction, Thesis Bullets. Return preview |
| 4.8 | Bulk upload page: drag-and-drop file → preview table | R2 | M | Show parsed rows. Inline error markers for malformed rows (missing ticker, etc.). Fix/remove controls |
| 4.9 | Bulk generation: enqueue jobs, progress via SSE | R2 | M | "Generating 12 of 47... ~4 min remaining". Background processing — persistent banner if user navigates away |
| 4.10 | Bulk generation: per-row error recovery + retry | R2 | M | Failed rows listed with error message + retry button. Successful rows unaffected |
| 4.11 | Downloadable bulk template file (.xlsx) | R2 | S | Static file served from API, linked from bulk upload page |
| 4.12 | Bulk job cancel support | R2 | S | `DELETE /api/bulk-generate/:jobId` → remove remaining queued jobs |

**Sprint 4 deliverable**: Dashboard is production-quality with search, filter, sort, keyboard nav. Bulk upload parses spreadsheets, shows preview, generates theses with progress, handles errors per-row.

**Parallelisable**: 4.1–4.5 (dashboard polish) are independent from 4.6–4.12 (bulk upload). Can be worked in parallel or interleaved.

---

## Sprint 5 — Integration, Edge Cases, Ship Prep (May 12–16)

**Goal**: All features integrated and tested. Edge cases handled. Ready to demo or deploy.

| # | Task | Req | Size | Notes |
|---|------|-----|------|-------|
| 5.1 | Weekly Log tab on thesis view: reverse-chronological table | R6 | M | TanStack Table: week, price %, vs index %, impact, summary. Count badge on tab. Empty state for Phase 1 (logs come in Phase 2) |
| 5.2 | End-to-end flow testing: single generation happy path | R1 | M | Enter holding → generate → view thesis → edit pillars → verify persistence |
| 5.3 | End-to-end flow testing: bulk upload happy path + error cases | R2 | M | Upload xlsx → preview → generate → verify all theses created |
| 5.4 | End-to-end: broker research upload → generation incorporates docs | R9 | M | Upload PDF → generate → verify agent received file paths → thesis references research |
| 5.5 | Loading states and empty states throughout | — | M | Generation progress, bulk progress banner, empty dashboard ("Add your first holding"), empty thesis sections |
| 5.6 | Error boundaries and fallback UI | — | S | React error boundaries. API error responses with consistent format |
| 5.7 | Holding status management: active/closed/paused | — | S | Status dropdown or controls on holding detail. Only active holdings shown by default on dashboard |
| 5.8 | Performance: dashboard loads <3s with 100 holdings | R5 | S | Paginate API if needed. Verify TanStack Table perf |
| 5.9 | Docker production build: multi-stage Dockerfile, Vite build served by Express | — | M | Single image, static assets served from Express. Verify `docker compose up` works from clean state |
| 5.10 | Environment documentation: `.env.example` with all required vars | — | S | Azure OpenAI endpoint, API key, DB URL, Redis URL |

**Sprint 5 deliverable**: Fully integrated Phase 1. All features working end-to-end. Production Docker image builds and runs. Ready for Phase 2 (weekly monitoring).

---

## Critical Path

The critical path runs through the AI agent and thesis generation — everything depends on being able to generate a thesis.

```
Week 1                    Week 2                     Week 3                    Week 4                  Week 5
Docker + DB + API ──────> ThesisAgent wrapper ──────> Thesis view + editing ──> Bulk upload queue ───> Integration
schema                    + generation service        + broker research          + progress              + testing
Dashboard shell           + Add Holding form          + auto-save               + error recovery         + polish
                          + SSE progress                                                               + ship prep
```

**Blocking dependencies** (must be done in order):
1. DB schema (Sprint 1) → API routes → generation service (Sprint 2)
2. ThesisAgent wrapper (Sprint 2) → thesis generation → thesis view (Sprint 3)
3. BullMQ setup (Sprint 4) depends on generation service (Sprint 2) being stable
4. Thesis editing (Sprint 3) depends on thesis detail page and stored thesis data

**Non-blocking / parallelisable work**:
- Dashboard polish (Sprint 4: 4.1–4.5) is independent from bulk upload (4.6–4.12)
- Document upload backend+frontend (Sprint 3: 3.7–3.8) is independent from thesis editing UI (3.1–3.6)
- Docker production build (Sprint 5: 5.9) is independent from feature testing (5.2–5.4)
- Frontend scaffold (Sprint 1: 1.5) can start alongside backend scaffold (1.1–1.4)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Codex SDK API differs from docs / has breaking changes | Medium | High | Sprint 2 starts with agent wrapper — discover issues early. Wrapper isolates blast radius |
| Azure OpenAI rate limits slow generation | Medium | Medium | BullMQ concurrency is configurable. Exponential backoff built in |
| Tiptap + pillar block editing takes longer than estimated | Medium | Medium | MVP: plain textarea editing. Upgrade to Tiptap blocks if time allows |
| Bulk upload edge cases (messy data, encoding) consume Sprint 4 | Low | Medium | Strict validation + preview step. Reject bad data early, don't over-engineer cleaning |
| SSE proxy buffering in dev | Low | Low | SSE bypasses Vite proxy in dev via direct API URL. In production, no proxy — not an issue |

---

## Phase 2 Handoff Checklist

At the end of Sprint 5, Phase 1 must leave these in place for Phase 2 (weekly monitoring):

- [ ] `weekly_logs` table exists with correct schema
- [ ] Weekly Log tab renders (empty state) on thesis view
- [ ] `ThesisAgent` wrapper has stub for `analyseWeekly()` method
- [ ] BullMQ infrastructure is proven (used by bulk generation)
- [ ] Holding `status` field works (active/closed/paused) — Phase 2 monitors only active
- [ ] Benchmark index is stored per holding and accessible to the agent
- [ ] Broker research file paths are queryable per holding

---

*Phase 1 last updated: 2026-04-14*

---
---

# Phase 2 — Weekly Monitoring + Email Digest

**Phase**: 2 — Weekly Monitoring + Email Digest (PRD: R4, R8, R12)
**Duration**: 3 weeks (3 x 1-week sprints)
**Team**: Single developer with AI-assisted coding
**Start date**: 2026-05-19 (after Phase 1 ship)

---

## Phase 1 → Phase 2 Handoff

Phase 1 delivered the following foundations that Phase 2 builds on:

- [x] `weekly_logs` table with full schema (price %, index %, relative perf, impact, pillar refs, sources)
- [x] `weeklyLogOutputSchema` Zod schema for AI output validation
- [x] `GET /api/holdings/:id/weekly-logs` endpoint (returns empty)
- [x] `WeeklyLogTable.tsx` component with empty state
- [x] `useWeeklyLogs()` TanStack Query hook
- [x] `ThesisAgent.analyseWeekly()` stub method
- [x] BullMQ + Redis infrastructure proven (bulk generation)
- [x] SSE progress streaming pattern (EventEmitter + `/progress` endpoint)
- [x] Holding `status` enum (active/closed/paused)
- [x] Benchmark stored per holding (S&P 500, FTSE 100, Nikkei 225, etc.)
- [x] Broker research file paths queryable per holding

---

## Key Design Decisions

### Market Data: `yahoo-finance2` npm package

No API key required. No daily request limits. Global equity coverage (LSE, TSE, ASX, HKEX, etc.). TypeScript types included. `chart()` method gives close-to-close historical data for weekly return calculations. Supports index symbols (`^GSPC`, `^FTSE`, `^N225`, etc.).

Risk: Uses Yahoo's unofficial public endpoints. Mitigation: all calls go through a `MarketDataService` class — swappable to a paid API (Twelve Data, Alpha Vantage) later without touching business logic.

Alternatives rejected: Alpha Vantage (25 req/day free — unusable at 500 holdings), Twelve Data (8/min rate limit — too slow), FMP (250 req/day free).

### Benchmark Symbol Mapping

Global majors supported:

| Benchmark | Yahoo Symbol |
|-----------|-------------|
| S&P 500 | `^GSPC` |
| NASDAQ Composite | `^IXIC` |
| Dow Jones | `^DJI` |
| Russell 2000 | `^RUT` |
| FTSE 100 | `^FTSE` |
| Euro Stoxx 50 | `^STOXX50E` |
| Nikkei 225 | `^N225` |
| Hang Seng | `^HSI` |
| ASX 200 | `^AXJO` |

### Price Data: Pre-fetched, Not Agent-Searched

The Devil's Advocate doc flags hallucinated prices as the #1 trust risk. We fetch prices via `yahoo-finance2` and pass them to the agent as verified input. The prompt explicitly says: "Use these exact figures. Do NOT search for price data." Post-parse, the service overwrites the agent's price fields with the actual MarketDataService values before persisting — belt-and-suspenders.

---

## Sprint 6 — Weekly Monitoring Vertical Slice (May 19–23)

**Goal**: Trigger weekly monitoring for a single holding. Full pipeline runs: fetch market data, AI analyses news + pillars, log entry appears in the UI.

| # | Task | Req | Size | Notes |
|---|------|-----|------|-------|
| 6.1 | Install `yahoo-finance2` dependency | R4 | S | `pnpm add yahoo-finance2` |
| 6.2 | `MarketDataService` class (`src/services/market-data.ts`) | R4 | M | `getWeeklyReturn(ticker)` + `getIndexWeeklyReturn(benchmark)`. Benchmark-to-symbol map. Returns `null` on failure (graceful degradation per PRD). Uses `chart()` with 10-day range for two Friday closes |
| 6.3 | `buildWeeklyPrompt()` + `WeeklyAnalysisInput` interface (`src/agent/prompts.ts`) | R4 | M | Prompt: search web for this week's news, read broker research, use pre-fetched price data (explicit: "Do NOT search for prices"), assess each pillar + assumption, output JSON per `weeklyLogOutputSchema` |
| 6.4 | Implement `ThesisAgent.analyseWeekly()` (replace stub in `src/agent/codex-agent.ts`) | R4 | M | Same pattern as `generateThesis()`: `startThread()` → prompt → outputSchema → stream → Zod parse. `modelReasoningEffort: "high"`, `webSearchMode: "live"`, research files in `additionalDirectories` |
| 6.5 | DB migration: unique index on `weekly_logs (holding_id, week_label)` | R4 | S | Idempotency guard. Update `src/db/schema.ts`, run `drizzle-kit generate` |
| 6.6 | `WeeklyMonitoringService` orchestrator (`src/services/weekly-monitoring.ts`) | R4 | L | Full pipeline: compute week label → idempotency check → load holding/thesis/pillars/docs → fetch market data → call agent → overwrite price fields with actual values → persist log + update holding in transaction |
| 6.7 | `POST /api/holdings/:id/weekly-logs/trigger` endpoint + SSE progress (`src/routes/theses.ts`) | R4 | M | Synchronous trigger for single holding. Returns 201 + log entry. 200 on idempotent re-trigger. 404/409/500 error handling. SSE progress via `progressEmitter` |
| 6.8 | Frontend: trigger button + mutation hook | R4 | M | New `useWeeklyMonitoring.ts` hook. "Run Weekly Check" button on WeeklyLogTable.tsx (empty state + above table). Loading spinner + "Analysing..." state. Toast on error. Invalidates `["weeklyLogs"]` + `["holdings"]` on success |
| 6.9 | WeeklyLogTable enhancements | R4 | S | Add "Relative %" column. Add expandable row detail showing pillar refs + sources |
| 6.10 | Unit tests: MarketDataService, `buildWeeklyPrompt()`, schema validation | R4 | M | Mock `yahoo-finance2`. Test % calculation, null on missing data, benchmark lookup, prompt content |
| 6.11 | Integration test: WeeklyMonitoringService full pipeline | R4 | M | Real Postgres via testcontainers, mocked agent + market data. Happy path, idempotency, skips paused/closed, null prices, missing thesis |

**Sprint 6 deliverable**: Click "Run Weekly Check" on any holding's Weekly Log tab → log entry appears with price data, pillar-by-pillar impact, summary, and sources.

**Parallelisable**: 6.1–6.3 + 6.5 (market data, prompt, migration) are independent — start all on day 1. 6.8–6.9 (frontend) is independent from 6.10–6.11 (tests).

**Task dependencies**:
```
Day 1:  [6.1] → [6.2]  |  [6.3]  |  [6.5]
Day 2:  [6.4] (needs 6.3)  |  [6.6] (needs 6.2, 6.3, 6.4, 6.5)
Day 3:  [6.7] (needs 6.6)
Day 4:  [6.8 + 6.9] (needs 6.7)  |  [6.10 + 6.11] (needs 6.6)
Day 5:  Manual E2E testing + polish
```

### New files
| File | Purpose |
|------|---------|
| `src/services/market-data.ts` | Yahoo Finance wrapper |
| `src/services/__tests__/market-data.test.ts` | Unit tests for market data |
| `src/services/weekly-monitoring.ts` | Pipeline orchestrator |
| `src/services/__tests__/weekly-monitoring.integration.test.ts` | Integration tests |
| `web/src/hooks/useWeeklyMonitoring.ts` | Trigger mutation hook |

### Modified files
| File | Change |
|------|--------|
| `package.json` | Add `yahoo-finance2` |
| `src/agent/prompts.ts` | Add `WeeklyAnalysisInput` + `buildWeeklyPrompt()` |
| `src/agent/codex-agent.ts` | Implement `analyseWeekly()` (replace stub) |
| `src/agent/__tests__/codex-agent.test.ts` | Add `analyseWeekly()` tests |
| `src/db/schema.ts` | Add unique index on `(holding_id, week_label)` |
| `src/routes/theses.ts` | Add trigger endpoint + SSE progress |
| `web/src/api/client.ts` | Add `triggerWeeklyMonitoring()` |
| `web/src/components/thesis/WeeklyLogTable.tsx` | Trigger button, relative % column, expandable rows |

---

## Sprint 7 — Scheduled Batch Monitoring (May 26–30)

**Goal**: All active holdings are monitored automatically every Monday at 6 AM. BullMQ handles concurrency, retries, and progress.

| # | Task | Req | Size | Notes |
|---|------|-----|------|-------|
| 7.1 | `node-cron` scheduler (`src/jobs/scheduler.ts`) | R4 | M | Monday 6 AM (configurable via `MONITORING_CRON_SCHEDULE` env var). Queries all active holdings, enqueues one job per holding. Idempotent: checks if week's batch already started |
| 7.2 | BullMQ `weekly-monitoring` queue (`src/jobs/queue.ts`) | R8 | M | Separate queue from `bulk-generation`. Concurrency 10 (configurable via `MONITORING_CONCURRENCY`). Retry 3x with exponential backoff |
| 7.3 | Weekly monitoring worker (`src/jobs/weekly-worker.ts`) | R8 | M | Job handler calls `WeeklyMonitoringService.monitorHolding()` (from Sprint 6 — zero rework). Emits progress events per holding |
| 7.4 | Batch progress tracking in Redis | R8 | M | Track: total holdings, completed, failed, in-progress. Batch key: `monitoring:batch:{weekLabel}`. TTL 7 days |
| 7.5 | `POST /api/monitoring/trigger` — manual batch trigger | R4 | S | Admin endpoint to kick off monitoring for all active holdings without waiting for cron. Useful for testing + on-demand runs |
| 7.6 | `GET /api/monitoring/status` — batch status endpoint | R8 | S | Returns current/latest batch: total, completed, failed, ETA |
| 7.7 | SSE endpoint: `GET /api/monitoring/progress` | R8 | M | Streams batch progress events. Reuses `progressEmitter` pattern from generation |
| 7.8 | Dashboard: "Latest Weekly Update" column | R4 | S | Show latest `thesisImpact` badge + date on holdings table. Already stored in `holding.latestImpact` — just render it |
| 7.9 | Dashboard: monitoring status banner | R8 | M | When batch is running: "Monitoring 12 of 47 holdings... ~4 min remaining" banner (reuses `BulkProgressBanner` pattern) |
| 7.10 | Config: new env vars | R8 | S | `MONITORING_CRON_SCHEDULE` (default: `0 6 * * 1`), `MONITORING_CONCURRENCY` (default: 10) |
| 7.11 | Error handling: per-holding failure isolation | R8 | M | Failed holdings don't block others. Failures logged with error detail. Failed holdings retry up to 3x. Final failures reported in batch status |
| 7.12 | Performance test: 100 holdings batch | R8 | M | Verify: completes without OOM, concurrency respected, retries work, status tracking accurate. Mock agent responses for speed |

**Sprint 7 deliverable**: `node-cron` fires Monday 6 AM, all active holdings get weekly logs automatically. Dashboard shows latest impact. Batch progress visible. Manual trigger available.

**Parallelisable**: 7.1–7.3 (scheduler + queue + worker) form the core chain. 7.8–7.9 (dashboard UI) are independent from backend. 7.10 (config) is independent.

**Task dependencies**:
```
Day 1:  [7.1] + [7.2] + [7.10]  (scheduler, queue, config — independent)
Day 2:  [7.3] (needs 7.2) + [7.4] (needs 7.2)
Day 3:  [7.5 + 7.6 + 7.7] (needs 7.3, 7.4)  |  [7.8] (independent)
Day 4:  [7.9] (needs 7.7)  |  [7.11] (needs 7.3)
Day 5:  [7.12] (needs everything)
```

---

## Sprint 8 — Email Digest + Polish (Jun 2–6)

**Goal**: Fund manager receives a weekly email digest after monitoring completes. All Phase 2 features polished and tested.

| # | Task | Req | Size | Notes |
|---|------|-----|------|-------|
| 8.1 | Email service setup (`src/services/email.ts`) | R12 | M | Nodemailer + SMTP (or SendGrid/AWS SES — configurable). `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_TO` env vars |
| 8.2 | Email template: weekly digest HTML | R12 | M | Subject: "Weekly Thesis Update — {date}". Body: X holdings updated, Y strengthened, Z weakened. Table: ticker, price %, impact, 1-line summary. Each row links to thesis view |
| 8.3 | Trigger email after batch completes | R12 | M | Hook into batch completion event from Sprint 7. Collect all log entries for the week, render template, send. Skip if no holdings were monitored |
| 8.4 | `GET /api/monitoring/history` — past batch runs | R4 | S | List of past weekly batches: date, total/success/failed counts. Useful for audit trail |
| 8.5 | Monitoring history UI on dashboard | R4 | M | "Monitoring History" section or modal: past runs with status counts. Click to see per-holding results |
| 8.6 | Weekly Log tab: pillar impact visualisation | R4 | M | Each log entry shows pillar chips with colour-coded impact (green/red/grey). Click to expand pillar detail |
| 8.7 | Holding status auto-update logic | R4 | S | After weekly log persisted: if impact = "weakened" for 3+ consecutive weeks, show warning indicator on dashboard |
| 8.8 | End-to-end test: full weekly monitoring cycle | R4 | L | Trigger batch → all holdings get logs → email sent → dashboard updated → logs visible on thesis view. Mocked agent, real DB + Redis |
| 8.9 | End-to-end test: manual single-holding trigger | R4 | S | From thesis view → "Run Weekly Check" → log appears. Already tested in Sprint 6 but verify no regressions |
| 8.10 | Performance validation: 500 holdings | R8 | M | Verify: completes within 2 hours (PRD target), no OOM, concurrency 10 sustained. Mock agent for speed |
| 8.11 | Error edge cases: no thesis, paused holding, price unavailable, agent timeout | R4 | M | Verify each case is handled gracefully with clear messaging |
| 8.12 | Documentation: update `.env.example`, `ARCHITECTURE.md`, `CLAUDE.md` | — | S | Document new env vars, Phase 2 architecture, monitoring workflow |

**Sprint 8 deliverable**: Weekly email digest delivered automatically. Monitoring history visible. All Phase 2 features tested end-to-end. Ready to deploy.

**Parallelisable**: 8.1–8.3 (email) are independent from 8.5–8.7 (UI polish). 8.8–8.11 (testing) depends on everything else.

---

## Phase 2 Critical Path

```
Week 1 (Sprint 6)              Week 2 (Sprint 7)                 Week 3 (Sprint 8)
MarketDataService ─────────────> node-cron scheduler ─────────────> Email service + template
Weekly analysis prompt            BullMQ queue + worker              Batch completion trigger
ThesisAgent.analyseWeekly()       Batch progress tracking            Monitoring history UI
WeeklyMonitoringService           Dashboard impact column            Pillar impact visualisation
Manual trigger API                Manual batch trigger               E2E testing
Frontend: trigger button          Monitoring progress banner         Performance validation (500)
```

**Blocking dependencies**:
1. `MarketDataService` (6.2) → `WeeklyMonitoringService` (6.6) → BullMQ worker (7.3)
2. `ThesisAgent.analyseWeekly()` (6.4) → monitoring service (6.6) → everything else
3. Batch progress tracking (7.4) → email trigger (8.3)
4. Single-holding pipeline (Sprint 6) must be stable before batch scaling (Sprint 7)

---

## Phase 2 Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `yahoo-finance2` rate-limited or blocked in Docker/CI | Medium | Medium | All tests mock `yahoo-finance2`. Manual E2E validates live. Can swap to Twelve Data if blocked |
| Agent takes >60s for weekly analysis, HTTP timeout on manual trigger | Medium | Low | `AbortSignal.timeout(120_000)` on trigger. Sprint 7 moves to async BullMQ — timeout is per-job |
| Agent ignores pre-fetched price data, hallucinates its own numbers | Low | High | Prompt: explicit "Use these exact figures." Service overwrites price fields post-parse with MarketDataService values |
| Yahoo Finance symbol mismatch for international tickers | Low | Medium | Users already enter Yahoo-format tickers (e.g. "SHEL.L"). Validation note in Add Holding form |
| Email delivery issues (spam, SMTP config) | Medium | Low | Start with simple SMTP. Test with Mailtrap in dev. Add SendGrid as fallback option |
| Weekly cron fires during maintenance / DB downtime | Low | Medium | Batch is idempotent (unique index). Re-run manually after recovery. No data lost |

---

## Sprint 9 — Test Hardening + Phase 3 Prep (Jun 9–13)

**Goal**: Run and validate all integration tests written during Phase 2. Fill gaps. Harden edge cases. Prepare for Phase 3.

| # | Task | Req | Size | Notes |
|---|------|-----|------|-------|
| 9.1 | Run + fix all integration tests from Sprints 6–8 | — | M | `weekly-monitoring.integration.test.ts`, batch monitoring tests, email tests. Fix any failures from code evolution |
| 9.2 | Add integration tests for paused/closed holding monitoring | R4 | S | Verify paused/closed holdings are skipped in both single trigger and batch |
| 9.3 | Add integration test for idempotent batch re-run | R8 | S | Trigger batch twice in same week — second run skips all holdings |
| 9.4 | Add E2E test: monitoring → email → dashboard update | R12 | M | Full cycle with mocked agent, real DB + Redis + email (Mailtrap or mock SMTP) |
| 9.5 | Stress test: 200+ holdings batch with mocked agent | R8 | M | Verify concurrency, retry, memory, and completion time |
| 9.6 | Frontend component tests for WeeklyLogTable trigger button | — | S | Test loading state, error toast, idempotent re-click |
| 9.7 | Audit test coverage gaps across Phase 2 code | — | M | Review all new services/routes for untested paths |
| 9.8 | Phase 3 prep: review PDF export PRD requirements | — | S | Read PRD R10, identify libraries, draft Sprint 10 scope |

**Sprint 9 deliverable**: All Phase 2 integration + E2E tests green. Confidence to deploy. Phase 3 scoped.

---

## Phase 3 Preview

After Phase 2, the PRD defines:

- **Phase 3** (1–2 weeks): PDF export — thesis + full log history as downloadable PDF
- **Future**: Multi-user RBAC, portfolio system integrations, Teams notifications, version history, sentiment scoring

---

*Phase 2 last updated: 2026-04-16*
