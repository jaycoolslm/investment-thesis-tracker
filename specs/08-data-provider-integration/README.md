# Spec 08 — Data Provider Integration

Final architecture for integrating the Thesis Tracker with a new self-hosted Data
Provider service (grown from `~/cowork/finance/ft-scrape`) and an article-to-holding
Mapping Agent (built on the eve framework). Single-user, self-hosted deployment.

This directory is the **single source of truth** for three independent implementation
efforts. Implementers get no other context — everything needed is here.

## Implementation status (2026-07-18)

All three apps are implemented: tracker changes in this repo's working tree
(uncommitted, pending review); data provider in ft-scrape commits dd7c505→134db79;
mapping agent in thesis-mapper commit bd74828. End-to-end integration of the three
live services has **not** yet been exercised. Two implementation deviations were
folded back into these specs: the mapper's MCP tool prefix is `data-provider__`
(eve rejects underscores in connection names), and the provider guarantees unique
`first_seen_at` per article to keep cursor paging gap-free (contracts.md §6).

| File | Audience |
|---|---|
| `README.md` | Everyone — architecture, decisions log |
| `contracts.md` | Everyone — every cross-application contract, precisely specified |
| `shared-types.ts` | Everyone — canonical TypeScript types (copy into each app) |
| `impl-provider.md` | Data Provider implementer (ft-scrape → service) |
| `impl-tracker.md` | Thesis Tracker implementer |
| `impl-mapper.md` | Mapping Agent implementer (eve project) |

## Components

1. **Thesis Tracker** (existing; this repo). Express 5 + TypeScript + Postgres 16 +
   Drizzle, React 19 frontend. AI thesis generation and weekly monitoring stay here,
   unchanged in shape. Small additions only (see `impl-tracker.md`).
2. **Data Provider** (new; grown from ft-scrape). One Bun process: daily FT crawl,
   SQLite storage, read-only HTTP API, and an MCP server over the same data. Headless —
   its health is surfaced inside the tracker's monitoring page.
3. **Mapping Agent** (new; eve framework, pinned preview version). A scheduled agent
   that reads new articles from the provider (via MCP), reads active holdings + thesis
   excerpts from the tracker (via HTTP), uses LLM judgment to decide which articles are
   thesis-relevant to which holdings, and **uploads each matched article to the holding
   as a document** — exactly like a manually uploaded broker-research file.

## Flow

```
            ┌────────────────────────────┐        ┌─────────────────────────────┐
            │  DATA PROVIDER (Bun)       │        │  THESIS TRACKER (Express)   │
 daily cron │  crawl FT sections         │        │                             │
 ──────────▶│  → SQLite (teasers)        │        │  Postgres: holdings, theses,│
            │                            │        │  weekly_logs, documents     │
            │  HTTP API ─── /health ─────┼───────▶│  monitoring page shows      │
            │  MCP server (/mcp)         │        │  provider health (proxied)  │
            └─────────▲──────────────────┘        └───────▲──────────▲──────────┘
                      │ MCP:                              │          │
                      │ list_new_articles                 │ HTTP:    │ weekly cron
                      │ get_article_body                  │ GET holdings/thesis
                      │ (fetch-once, cache body)          │ GET/POST documents
            ┌─────────┴──────────────────────────────────┴───┐      │
            │  MAPPING AGENT (eve, daily schedule)            │      │
            │  1. list new articles (last 48 h window)        │      ▼
            │  2. fetch active holdings + thesis excerpts     │  weekly analysis reads
            │  3. LLM: which articles matter to which         │  ALL of a holding's
            │     holdings? (nuance, not keywords)            │  documents — including
            │  4. per match: get body, upload markdown        │  mapper-uploaded
            │     document to the holding (idempotent)        │  articles — as context
            └─────────────────────────────────────────────────┘
```

The weekly monitoring flow is **untouched**: node-cron fires `runMonitoringBatch`,
which per holding loads the thesis, loads **all documents** (now including mapped
articles), fetches Yahoo market data, and calls the analysis agent with web search.
Uploaded articles simply become additional context the weekly agent reads, the same
way broker-research PDFs do today (`src/services/weekly-monitoring.ts` step 5 →
`researchFilePaths` → the "BROKER RESEARCH FILES" section of the weekly prompt).

## Decisions log

Accepted:
- **No event-driven analysis.** Matched articles are delivered as holding documents;
  the unchanged weekly analysis consumes them on its normal cadence. (Supersedes the
  earlier v2 design's `runEventAnalysis`, current-week-log upserts, and debounce.)
- **eve framework confirmed** for the mapping agent. Pin the preview version (0.25.x)
  exactly; eve is pre-GA and its APIs may change.
- **FT crawl: once a day** (default 06:00 local).
- **LLM-based mapping, not keyword matching.** The mapper must catch read-across
  nuance (e.g. holding = Exxon Mobil; a Chevron Permian article is still relevant).
- **Provider = one Bun process**: SQLite + read-only HTTP API + MCP server
  (streamable HTTP). Headless; health shown in the tracker's monitoring page.
- **Article bodies fetched once, on match**, stored in provider SQLite, served from
  cache for any later holding that matches the same article.
- **Non-premium FT only.** The user's FT access is non-premium; the existing premium
  filter in the crawler stands.
- **Yahoo returns and agent web search stay in the weekly run**, unchanged.
- **Thesis excerpt as mapper input**: ticker + company + direction + the first
  1,500 characters of the thesis markdown (not the full document).
- **Mapping state lives in the tracker's `documents` table** — no new
  `article_matches` table. The uploaded document row *is* the mapping edge; article
  metadata + match rationale travel in the file's frontmatter. Justification in
  `contracts.md` §5.
- **No shared package.** `shared-types.ts` is copy-pasted into each app with a header
  comment naming this file as source of truth.

Explicitly rejected:
- Event-triggered per-holding thesis analysis (any form).
- A third "sync service" process (the mapper is an agent, not a sync layer).
- A structured `article_matches` Postgres table.
- Keyword/ticker-match mapping as the primary mechanism.
- Moving Yahoo market data into the provider (possible later; not now).
- Multitenancy features of any kind. The only door-keeper decisions are: all
  cross-app access goes over HTTP/MCP (no shared DB files), and article keys are
  namespaced by source.
