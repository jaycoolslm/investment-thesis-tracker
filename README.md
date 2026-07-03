# Thesis Tracker

AI-powered investment thesis generation and weekly monitoring for fund managers. Generate a structured, pillar-based thesis from a ticker + a few bullets, upload broker research, and get a weekly automated review of how each pillar is holding up.

## How this was built

Built end-to-end with [Claude Code](https://claude.com/claude-code), the Anthropic CLI agent, using its **knowledge-work plugins** as collaborators:

- **product-management** — produced `PRD.md`, the user stories, and `DEVILS-ADVOCATE.md` (a structured stress test of the spec)
- **engineering** — produced `ARCHITECTURE.md`, `TESTING-STRATEGY.md`, and `SPRINT-PLAN.md` (10 sprints across 3 phases)
- **design** — produced `UX-DESIGN.md` and `DESIGN-HANDOFF.md` (component specs + tokens + accessibility notes)
- **marketing** — produced `MARKETING-CAMPAIGN.md` (launch plan)

Each sprint was scoped, planned (with fresh doc lookups for every library), implemented, and tested in a single Claude Code session, then committed. `CLAUDE.md` is the live project briefing the agent reads on every session.

The product itself uses the **Codex SDK + Azure OpenAI (GPT-5.4-mini)** for thesis generation and weekly analysis — web search and PDF reading are done natively by the agent rather than via a custom RAG pipeline.

See `CLAUDE.md` for the full architecture, project structure, and conventions.

## Running locally (dev)

Three terminals — infra in containers, backend + frontend on the host with hot-reload.

```bash
# 1. Infrastructure (Postgres + Redis)
docker compose up -d postgres redis

# 2. One-time DB setup
pnpm install
pnpm db:migrate
pnpm db:seed              # 3 sample holdings (optional)

# 3. Backend (terminal 2)
pnpm dev

# 4. Frontend (terminal 3)
cd web && pnpm dev
```

Open <http://localhost:5173>. Vite proxies `/api` to the backend on 3001.

### Tests

```bash
pnpm test                 # 85 backend unit tests
pnpm test:integration     # 46 integration tests (Testcontainers — needs Docker)
cd web && pnpm test       # 22 frontend component tests
pnpm test:e2e             # 9 Playwright E2E tests (needs Docker + dev servers)
```

`MOCK_AGENT=true` makes the AI calls return fixture data — used by E2E tests and useful for local demo without burning Azure OpenAI credits.

## Running production-like locally

A single image serves the React bundle + API on port 3001.

```bash
docker compose -f docker-compose.prod.yml up -d --build
pnpm db:migrate           # runs from host against exposed Postgres on :5432
```

Open <http://localhost:3001>.

The migration step runs from the host because the prod runner image doesn't ship `drizzle-kit` configs — it's just compiled JS + the React bundle. There's a 5–10s window after the api container starts where routes will 500 with `relation "holdings" does not exist`; once `db:migrate` returns, routes work immediately (no restart needed).

Tear down: `docker compose -f docker-compose.prod.yml down`.

## Required env vars

For real (non-mocked) AI generation you need Azure OpenAI credentials. See `.env.example`.

```
OPENAI_API_KEY=...                 # used by Codex SDK
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_API_KEY=...
```

Email digests (Sprint 8) are optional — set `SMTP_*` and `EMAIL_*` to enable, otherwise the app skips them gracefully.
