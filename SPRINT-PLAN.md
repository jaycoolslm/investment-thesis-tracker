# Thesis Tracker — Phase 1 Sprint Plan

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

*Last updated: 2026-04-14*
