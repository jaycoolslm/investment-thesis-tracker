# Thesis Tracker — Architecture

**Version**: 2.0
**Date**: 2026-04-14
**Status**: Draft — simplified to match Codex SDK capabilities

---

## 1. System Overview

Thesis Tracker is a web app with three modes: interactive (create holdings, generate theses), batch (bulk spreadsheet upload), and scheduled (weekly monitoring). The core insight driving the architecture: **the Codex SDK agent does the heavy lifting** — web search, document reading, financial analysis. Our job is to orchestrate it, store results, and present them.

```
+------------------------------------------+
|              Web UI (React)              |
+------------------------------------------+
                    |
              REST (polled)
                    |
+------------------------------------------+
|          API Server (Express.js)         |
+------------------------------------------+
        |              |             |
+---------------+ +----------+ +----------+
| Codex SDK     | | File     | | BullMQ   |
| (AI Agent)    | | Storage  | | + Redis  |
+---------------+ +----------+ +----------+
        |                            |
   Azure OpenAI              +----------+
   (GPT 5.1 Codex)          |PostgreSQL |
                             +----------+
```

No pgvector. No embedding pipeline. No document chunking. No separate search provider. The Codex agent handles web search and file reading natively.

---

## 2. Technology Choices

### ADR-001: Backend — Express.js + TypeScript

**Decision**: Express.js on Node.js 20 LTS, TypeScript throughout.

**Why**: PRD mandates JS and Codex CLI SDK. Express is zero-magic, every dev knows it. NestJS adds overhead a small team doesn't need. The bottleneck is AI inference (seconds), not HTTP routing.

### ADR-002: Frontend — React + Vite

**Decision**: React 19 + Vite + TanStack Table + Tailwind + Radix UI.

**Why**: The UI is a dashboard, a thesis detail view, a form, and a file upload. TanStack Table for sortable holdings grid. Radix for accessible primitives. Tiptap for thesis editing (structured, auto-save). Keep it light — no MUI.

### ADR-003: Database — PostgreSQL (no pgvector)

**Decision**: PostgreSQL 16. Plain relational. No vector extensions.

**Why**: We don't need vector search. Broker research PDFs are saved as files and read directly by the Codex agent — no chunking, no embeddings. Postgres stores holdings, theses, pillars, weekly logs, and document metadata. That's it.

**ORM**: Drizzle — TypeScript-native, readable SQL, good migrations.

### ADR-004: Job Queue — BullMQ + Redis

**Decision**: BullMQ for bulk generation and weekly monitoring jobs.

**Why**: Need concurrent execution (configurable parallelism), retry with backoff, and job visibility. BullMQ gives all of this. Redis is lightweight, runs anywhere Docker runs. Cloud-agnostic per PRD.

### ADR-005: AI Agent — Codex CLI SDK

**Decision**: `@openai/codex-sdk` pointing at Azure OpenAI (GPT 5.1 Codex).

**Why**: The Codex agent has built-in capabilities that eliminate most of our complexity:
- **Web search**: The agent searches the web natively. No Tavily, no Serper, no search provider abstraction.
- **File reading**: The agent can read files directly. Pass it broker research PDFs/DOCX and it interrogates them as part of its reasoning. No parsing libraries, no chunking, no vector store.
- **Structured output**: The agent can be prompted to produce JSON-structured thesis documents.

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread();

// Generate a thesis — agent handles web search + file reading
const result = await thread.run(`
  Generate an investment thesis for ${ticker} (${direction}).
  
  Fund manager's conviction:
  ${bullets}
  
  Broker research files to incorporate:
  ${filePaths.join('\n')}
  
  Search the web for current market context, financials, and recent news.
  
  Output as JSON matching this schema: ${JSON.stringify(thesisSchema)}
`);
```

### ADR-006: Broker Research — Just Save the Files

**Decision**: Upload PDFs/DOCX to filesystem. Pass file paths to the Codex agent. No parsing, no chunking, no embeddings.

**Why**: The Codex agent has a built-in [PDF skill](https://github.com/openai/skills/blob/main/skills/.curated/pdf/SKILL.md) that reads PDFs with layout fidelity using `pdfplumber`/`pypdf` and can render pages to PNGs for visual inspection. It handles broker research documents — including multi-column layouts, tables, and charts — natively. No application-level parsing required.

- Files stored in a Docker volume (`/data/documents/{holdingId}/`)
- Metadata (filename, size, type, upload date) in Postgres
- At generation/analysis time, pass the file paths to the agent prompt
- Context size is not a concern — the agent handles large documents

### ADR-007: Containers — Docker Compose

**Decision**: Three containers: `api`, `postgres`, `redis`.

**Why**: Cloud-agnostic per PRD. `docker compose up` for local dev. Same images deploy to K8s, ECS, Fly.io, or a VM.

---

## 3. Codex Agent Integration

### Agent Wrapper

A thin wrapper around the Codex SDK that provides typed methods for our two core operations:

```typescript
// src/agent/codex-agent.ts

import { Codex } from "@openai/codex-sdk";

export class ThesisAgent {
  private codex: Codex;

  constructor() {
    this.codex = new Codex();
  }

  async generateThesis(input: {
    ticker: string;
    companyName: string;
    direction: "long" | "short";
    bullets: string;
    benchmarkIndex: string;
    researchFilePaths: string[];
  }): Promise<ThesisDocument> {
    const thread = this.codex.startThread();
    const result = await thread.run(buildGenerationPrompt(input));
    return parseThesisResponse(result);
  }

  async analyseWeekly(input: {
    holding: Holding;
    thesis: ThesisDocument;
    researchFilePaths: string[];
  }): Promise<WeeklyLogEntry> {
    const thread = this.codex.startThread();
    const result = await thread.run(buildWeeklyPrompt(input));
    return parseWeeklyResponse(result);
  }
}
```

### Why No Provider Abstraction in v1

The previous architecture had an `AgentProvider` interface with factory pattern for swapping between Codex and Anthropic. For the MVP, this is YAGNI. The Codex SDK has a specific API (`startThread()`, `thread.run()`). Anthropic's Agent SDK will have a different API. An abstraction written today will be wrong when we actually need to swap.

**When to add it**: When there's a concrete need for a second provider. At that point, extract the interface from the working Codex implementation. The wrapper above (`ThesisAgent`) already isolates the SDK from business logic — that's enough.

### Prompt Engineering

Prompts live in a dedicated file, not inline. The agent prompt for thesis generation includes:
1. The thesis template structure (pillars, quality assessment, assumptions, risks, etc.)
2. The user's bullet points
3. File paths to broker research (if any)
4. Instructions to search the web for market context, financials, and news
5. The output JSON schema

The prompt for weekly analysis includes:
1. The full current thesis (so the agent knows the pillars and assumptions)
2. File paths to broker research
3. Instructions to search for the latest week's news and price data
4. The benchmark index for relative performance
5. Instructions to assess impact on each pillar/assumption

```typescript
// src/agent/prompts.ts

export function buildGenerationPrompt(input: GenerationInput): string {
  return `You are an investment research analyst. Generate a structured 
investment thesis based on the fund manager's conviction and your own research.

HOLDING: ${input.ticker} (${input.companyName}) — ${input.direction}
BENCHMARK: ${input.benchmarkIndex}

FUND MANAGER'S THESIS BULLETS:
${input.bullets}

${input.researchFilePaths.length > 0 ? `
BROKER RESEARCH (read these files for context):
${input.researchFilePaths.join('\n')}
` : ''}

INSTRUCTIONS:
1. Search the web for current information about ${input.companyName}: 
   financials, recent earnings, news, competitive landscape, sector trends.
2. ${input.researchFilePaths.length > 0 ? 'Read the broker research files above.' : ''}
3. Generate a thesis with the following structure:

${THESIS_JSON_SCHEMA}

Be specific. Use real numbers from your research. Cite sources.
Each pillar must be a discrete, falsifiable argument.
Assumptions must be measurable conditions that can be checked.
Risks must be specific (not generic).`;
}

export function buildWeeklyPrompt(input: WeeklyInput): string {
  return `You are an investment research analyst performing a weekly review.

HOLDING: ${input.holding.ticker} — ${input.holding.direction}
BENCHMARK: ${input.thesis.benchmarkIndex}

CURRENT THESIS:
${JSON.stringify(input.thesis, null, 2)}

${input.researchFilePaths.length > 0 ? `
BROKER RESEARCH (read for context):
${input.researchFilePaths.join('\n')}
` : ''}

INSTRUCTIONS:
1. Search the web for news about ${input.holding.companyName} from the past week.
2. Search for the current share price and the week-over-week change.
3. Search for the ${input.thesis.benchmarkIndex} index performance this week.
4. Calculate relative performance (stock move minus index move).
5. Assess each thesis pillar: strengthened, weakened, or unchanged.
6. Check each key assumption: still intact or broken.
7. Produce a weekly log entry as JSON:

${WEEKLY_LOG_JSON_SCHEMA}`;
}
```

---

## 4. Data Model

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   holdings   │     │    theses        │     │  thesis_pillars  │
├──────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)      │────<│ id (PK)          │────<│ id (PK)          │
│ ticker       │     │ holding_id (FK)  │     │ thesis_id (FK)   │
│ company_name │     │ summary          │     │ title            │
│ direction    │     │ quality_assess.  │     │ body             │
│ benchmark    │     │ valuation (JSON) │     │ sort_order       │
│ status       │     │ assumptions (J)  │     │ created_at       │
│ latest_impact│     │ risks (JSON)     │     │ updated_at       │
│ last_updated │     │ sources (JSON)   │     └──────────────────┘
│ created_at   │     │ created_at       │
└──────────────┘     │ updated_at       │
                     └──────────────────┘
                            
┌──────────────────┐     ┌──────────────────┐
│  weekly_logs     │     │   documents      │
├──────────────────┤     ├──────────────────┤
│ id (PK)         │     │ id (PK)          │
│ holding_id (FK) │     │ holding_id (FK)  │
│ week_label      │     │ filename         │
│ week_date       │     │ file_path        │
│ price_change_pct│     │ file_type        │
│ index_change_pct│     │ file_size        │
│ relative_perf   │     │ created_at       │
│ thesis_impact   │     └──────────────────┘
│ summary         │
│ pillar_refs (J) │
│ sources (JSON)  │
│ created_at      │
└──────────────────┘
```

**Key decisions**:
- Thesis pillars are first-class rows (not JSON) so weekly logs can reference them by ID.
- Weekly logs are append-only. `pillar_refs` is JSONB — a snapshot of which pillars were impacted and how.
- Documents table stores metadata only. Files live on disk at `/data/documents/{holdingId}/{filename}`.
- No `users` table in v1. Add when multi-user is needed — `user_id` column can be added to holdings then.
- `status` on holdings: `active | closed | paused`. Only `active` holdings get weekly monitoring.

---

## 5. Weekly Job Execution

```
node-cron (Monday 6 AM, configurable)
    │
    ▼
Orchestrator: query all active holdings
    │
    ▼
BullMQ queue: one job per holding
    │  Concurrency: 10 (configurable)
    │  Retry: 3x with exponential backoff
    ▼
Worker (per holding):
    1. Get thesis + pillar data from DB
    2. Get broker research file paths from DB
    3. Call ThesisAgent.analyseWeekly()
       (agent searches web + reads files internally)
    4. Parse response → WeeklyLogEntry
    5. Store log entry in DB
    6. Update holding.latest_impact and holding.last_updated
```

Idempotent via `holdingId + weekLabel` — if a log entry for that week exists, skip.

**Performance**: 500 holdings, concurrency 10, ~30s per holding = ~25 minutes. Well under the 2-hour target.

---

## 6. API Design

```
Holdings
  GET    /api/holdings                    — Dashboard list
  POST   /api/holdings                    — Create holding
  GET    /api/holdings/:id                — Detail with thesis + logs
  PUT    /api/holdings/:id                — Update holding
  DELETE /api/holdings/:id                — Remove holding

Thesis
  POST   /api/holdings/:id/generate       — Generate thesis
  PUT    /api/theses/:id                  — Edit thesis fields
  PUT    /api/theses/:id/pillars/:pid     — Edit pillar
  POST   /api/theses/:id/pillars          — Add pillar
  DELETE /api/theses/:id/pillars/:pid     — Remove pillar

Bulk
  POST   /api/bulk-generate               — Upload spreadsheet
  GET    /api/bulk-generate/:jobId        — Poll status

Weekly Logs
  GET    /api/holdings/:id/logs           — All logs for a holding
  POST   /api/holdings/:id/logs/trigger   — Manual trigger

Documents
  GET    /api/holdings/:id/documents      — List docs
  POST   /api/holdings/:id/documents      — Upload file
  DELETE /api/documents/:id               — Delete file

Export
  GET    /api/holdings/:id/export/pdf     — PDF export (P1)
```

Progress is polled: `GET /api/holdings/:id/generation-status` for generation, `GET /api/bulk-generate/:batchId/status` for bulk, `GET /api/monitoring/status` for batch monitoring. No SSE/WebSockets.

---

## 7. Project Structure

```
thesis-tracking/
  docker-compose.yml
  Dockerfile
  .env.example
  package.json
  tsconfig.json
  drizzle.config.ts
  src/
    server.ts                    — Express entry point
    config.ts                    — Env config with validation
    routes/
      holdings.ts
      theses.ts
      documents.ts
      bulk.ts
    agent/
      codex-agent.ts             — ThesisAgent wrapper
      prompts.ts                 — All prompt templates
      schemas.ts                 — JSON schemas for structured output
    services/
      thesis-generation.ts       — Orchestrates generation flow
      weekly-monitoring.ts       — Orchestrates weekly analysis
    db/
      schema.ts                  — Drizzle schema
      migrations/
      index.ts                   — DB connection
    jobs/
      queue.ts                   — BullMQ setup
      workers/
        weekly-monitoring.ts
        bulk-generation.ts
      scheduler.ts               — node-cron definitions
  web/
    vite.config.ts
    src/
      App.tsx
      pages/
        Dashboard.tsx
        HoldingDetail.tsx
        BulkUpload.tsx
      components/
        ThesisView.tsx
        PillarEditor.tsx
        WeeklyLogTable.tsx
        DocumentUpload.tsx
        HoldingsTable.tsx
      hooks/
        useHoldings.ts
        useThesis.ts
        useGenerationProgress.ts
      api/
        client.ts                — Typed API client
```

**What's gone** compared to v1 architecture:
- No `providers/` directory (no provider abstraction)
- No `search/` directory (no search provider)
- No `utils/chunker.ts`, `parsers.ts` (no document pipeline)
- No `document-processing` worker (no async parsing/embedding)

---

## 8. Deployment

### Dev
```bash
docker compose up  # api + postgres + redis
```

### Prod
Single multi-stage Dockerfile:
1. Build frontend (Vite)
2. Build backend (TypeScript)
3. Slim production image serves both

Three containers: `api`, `postgres`, `redis`. Data volume at `/data/documents/` for broker research files.

---

## 9. What We're Deferring

| Item | When to add |
|------|-------------|
| AgentProvider abstraction | When a second AI provider is actually needed |
| Dedicated market data API | When web search price accuracy becomes a real user complaint |
| Authentication / multi-user | When there's more than one user |
| OCR for scanned PDFs | When users upload image-based PDFs and complain |

---

*Simpler is faster. Build the MVP, ship it, then add complexity where users actually need it.*
