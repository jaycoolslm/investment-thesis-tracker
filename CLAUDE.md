# Thesis Tracker

AI-powered investment thesis generation and weekly monitoring tool for fund managers.

## Project Status

Sprint 2 complete (Apr 21-25). AI agent + single thesis generation end-to-end. ThesisAgent wrapper, generation service, SSE progress streaming, Add Holding modal, all working. Starting Sprint 3 (thesis view + editing + broker research upload).

## Key Documents

Read these before making architectural or UX decisions:

- `PRD.md` — Product requirements (v2.1). Pillar-based thesis template, all user stories, acceptance criteria.
- `ARCHITECTURE.md` — Tech architecture (v2.0). Simplified: Codex SDK does web search + file reading natively.
- `SPRINT-PLAN.md` — 5-week Phase 1 sprint plan with concrete tasks per week.
- `DESIGN-HANDOFF.md` — Developer-ready component specs, design tokens, interaction states.
- `TESTING-STRATEGY.md` — 6-layer test strategy. Zod schema validation is the critical layer.
- `UX-DESIGN.md` — UX critique, screen-by-screen copy, accessibility notes.
- `DEVILS-ADVOCATE.md` — Risk analysis and stress test of the PRD.

## Tech Stack

- **Backend**: Express 5 + TypeScript 6 on Node.js 20 LTS (Docker) / Node 24 (local)
- **Frontend**: React 19 + Vite 8 + TanStack Table + TanStack Query + Tailwind CSS v4 + Radix UI + Tiptap
- **Database**: PostgreSQL 16 + Drizzle ORM 0.45 (pg driver)
- **Validation**: Zod v4 (env config, API input, AI output)
- **Jobs**: BullMQ + Redis
- **AI**: Codex CLI SDK (`@openai/codex-sdk`) → Azure OpenAI (GPT 5.1 Codex)
- **Containers**: Docker Compose (api + postgres + redis)
- **Package manager**: pnpm (separate package.json for root backend + web/ frontend)

## Architecture Principles

1. **The Codex agent does the heavy lifting.** Web search, file reading (broker research PDFs), financial analysis — all handled natively by the agent. No vector store, no document parsing pipeline, no search provider abstraction.
2. **Broker research = save file, pass path to agent.** PDFs/DOCX saved to `/data/documents/{holdingId}/`. The agent reads them directly via its built-in PDF skill.
3. **No provider abstraction in v1.** A thin `ThesisAgent` wrapper class isolates the SDK from business logic. That's enough. Extract an interface when a second provider is actually needed.
4. **Thesis pillars are first-class DB rows** (not JSONB) so weekly logs can reference them by ID.
5. **Weekly logs are append-only.** `pillar_refs` is JSONB — a snapshot of which pillars were impacted.

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
      theses.ts                — GET /api/holdings/:id/thesis (fetch thesis + pillars)
      documents.ts             — POST/GET /api/holdings/:id/documents (file upload)
    agent/
      codex-agent.ts           — ThesisAgent wrapper around @openai/codex-sdk
      prompts.ts               — buildGenerationPrompt() + GenerationInput interface
      schemas.ts               — Zod schemas for AI output (thesis, pillars, risks, etc.)
    services/
      thesis-generation.ts     — Orchestrates: validate → agent call → persist in transaction
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
      main.tsx                 — Entry point, QueryClientProvider
      App.tsx                  — Top bar + modal + progress flow + toasts
      globals.css              — Tailwind v4 @theme tokens (brand, accent, status colours)
      pages/
        Dashboard.tsx           — Holdings list with loading/empty/error states
      components/
        HoldingsTable.tsx       — TanStack Table, 7 columns, sorting, delete action
        AddHoldingModal.tsx     — Radix Dialog: ticker, direction, benchmark, bullets, file upload
        GenerationProgress.tsx  — Multi-step progress indicator (SSE-driven)
        FileDropZone.tsx        — Drag-and-drop PDF/DOCX upload zone
        Toast.tsx               — Toast notification container
        StatusBadge.tsx         — Strengthened/Weakened/Unchanged badges
        DirectionBadge.tsx      — Long/Short badges
        LoadingSkeleton.tsx     — 8-row pulsing skeleton
        EmptyState.tsx          — "No holdings yet" prompt
      hooks/
        useHoldings.ts          — TanStack Query: useHoldings, useCreateHolding, useDeleteHolding
        useGenerateThesis.ts    — Mutation: create holding → upload files
        useGenerationProgress.ts — SSE progress tracking (fires generation after EventSource connects)
        useToast.ts             — Toast state management
      api/
        client.ts               — Typed fetch: holdings, theses, documents, generation
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

## Sprint Plan (Phase 1)

| Sprint | Week | Focus | Status |
|--------|------|-------|--------|
| S1 | Apr 14-18 | Foundation — Docker, DB schema, Express + React scaffold, dashboard shell | Done |
| S2 | Apr 21-25 | AI agent + single thesis generation end-to-end | Done |
| S3 | Apr 28-May 1 | Thesis view + editing + broker research upload | |
| S4 | May 5-9 | Dashboard polish (search/filter/badges) + bulk upload | |
| S5 | May 12-16 | Integration testing + ship prep | |

## Git Workflow

- **Commit after completing each sprint.** One commit per sprint with a summary of what was built.
- **Commit again after any post-sprint iterations** (bug fixes, architecture changes like WS→SSE). Separate commit from the sprint commit so the history shows what was planned vs. what was fixed.
- Commit messages should summarize the "what" and "why", not list every file changed.

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
