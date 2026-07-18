# Implementation Brief — Data Provider Service

Turn the ft-scrape prototype at `~/cowork/finance/ft-scrape` into the Data Provider
service. Read `README.md`, `contracts.md`, and `shared-types.ts` in this directory
first; the contracts there are binding.

## Current state of ft-scrape (verified 2026-07-18)

Bun + TypeScript, no runtime deps, **not a git repo**. Files:
- `ft-client.ts` — fetches FT pages with browser-mimicking headers and a **hardcoded
  session cookie in source** (`COOKIE` const).
- `sections.ts` — `SECTIONS = ["markets","companies","technology","us","alphaville"]`,
  `fetchSection()` fetches `https://www.ft.com/<section>`.
- `teasers.ts` — `parseTeasers()` via Bun `HTMLRewriter`; drops premium-labelled
  teasers (keep this — the user's FT access is non-premium).
- `db.ts` — SQLite (`bun:sqlite`, WAL), old-shape `articles` table, `insertNewTeasers`
  with `INSERT OR IGNORE` (returns only newly inserted rows).
- `crawl.ts` — loops sections with random 10–30 s delays, manual invocation only.
- `index.ts` — `fetchArticle(url)` parses full body + `datePublished` from the article
  page's JSON-LD `NewsArticle`. Written but unused by the crawl.
- `responses/*.html` — saved section HTML (use as parser fixtures).

## Scope

### Phase 0 — hardening
1. `git init`; commit the prototype as-is first, then commit each change.
2. Move the cookie to `FT_COOKIE` env (Bun auto-loads `.env`; add `.env` to
   `.gitignore`, provide `.env.example`). Fail fast at startup with a clear message
   when unset.
3. Schema migration to the target schema in `contracts.md` §6 (source column,
   composite PK, `published_at`, `body`, `body_fetched_at`, FTS5 table + sync
   triggers, `crawl_runs`). Auto-run at startup when `PRAGMA table_info(articles)`
   lacks `source`. Existing 145 rows must survive with `source='ft'`.
4. Wrap each crawl in a `crawl_runs` row: insert at start, update
   `finished_at`/`articles_seen`/`articles_new` on success, `error` + `finished_at`
   on failure. A thrown section fetch fails the run but must not crash the process.

### Phase 1 — long-running service
5. Single entrypoint (`server.ts`): `Bun.serve()` on `DP_PORT` (default 3002) hosting
   the HTTP API of `contracts.md` §2 (`/health`, `/articles`, `/articles/:key`,
   `POST /articles/:key/body`, `/crawl-runs`).
6. Daily crawl on `DP_CRAWL_CRON` (default `0 6 * * *`). Use the `croner` package
   (works under Bun) — do not hand-roll cron parsing. Also crawl once at boot if the
   last successful run is older than 24 h (catch-up after downtime). Guard against
   overlapping runs with a simple in-process flag.
7. Body fetch (`POST /articles/:key/body` and the MCP `get_article_body`): reuse
   `fetchArticle()` from `index.ts`; on success store `body`, `body_fetched_at`, and
   backfill `published_at` from JSON-LD `datePublished`. Idempotent: cached body →
   return without refetching. Upstream failure → 502 per contract, no internal retry.

### Phase 2 — MCP server
8. `@modelcontextprotocol/sdk` streamable-HTTP server mounted at `POST /mcp` in the
   same process, exposing exactly the four tools of `contracts.md` §3, backed by the
   same query functions as the HTTP routes (one shared data layer, two thin surfaces).

## Out of scope

- Any provider other than FT (but keep the seam: crawl + parse behind a small
  `Provider` interface `{ source, crawl(db): Promise<CrawlStats> }` so XX/YY
  providers slot in later).
- Auth, HTTPS, rate limiting, UI, Postgres, docker (optional nicety, not required).
- Mapping logic, LLM calls, tracker awareness — the provider knows nothing about
  holdings.
- Re-crawling/backfilling premium articles.

## Files to create/modify (suggested layout)

```
ft-scrape/
  server.ts        NEW — entrypoint: Bun.serve (HTTP routes + /mcp) + croner schedule
  crawl.ts         MODIFY — crawl_runs bookkeeping, Provider interface
  db.ts            MODIFY — new schema + startup migration + query helpers
                   (listArticles, getArticle, storeBody, searchArticles, health)
  ft-client.ts     MODIFY — cookie from process.env.FT_COOKIE
  index.ts         MODIFY → rename to article-body.ts (fetchArticle stays as-is)
  mcp.ts           NEW — MCP server wiring the four tools to db.ts helpers
  shared-types.ts  NEW — copied from this spec directory (keep header)
  *.test.ts        NEW — bun:test files
  .env.example     NEW
```

## Acceptance criteria

1. Fresh checkout + `.env` with `FT_COOKIE` + `bun server.ts` → serves 3002; `GET
   /health` returns the contract shape with `sources[0].source === "ft"`.
2. Startup against a copy of the **old-shape** `ft.sqlite` migrates it losslessly
   (145 rows, all `source='ft'`, PK `(source,id)`).
3. `GET /articles?since=<past>&limit=5` pages correctly: 5 rows ascending by
   `first_seen_at`, `nextCursor` equals the 5th row's `first_seen_at`, and passing it
   back yields the next page with no overlap or gap.
4. `POST /articles/ft:<id>/body` twice → second call returns the cached body without
   any outbound fetch (assert via an injected/mocked fetch).
5. Unknown key → 404 `{error}`; malformed key → 400; upstream failure → 502 with
   `detail`.
6. MCP: a streamable-HTTP MCP client (e.g. the SDK's client) lists exactly 4 tools
   and `list_new_articles` output matches `GET /articles` for the same params.
7. Crawl failure (e.g. bad cookie) produces a `crawl_runs` row with `error` set and
   the process stays up; `/health` surfaces it.

## Standalone testing (no FT, no other apps)

- **Parser tests:** run `parseTeasers()` against the saved `responses/*.html`
  fixtures; assert counts and a few known headlines. Same for `parseArticle()` — save
  one article-page HTML fixture.
- **`MOCK_FT=true` env:** `ft-client.ts` returns fixture HTML from `responses/`
  instead of hitting ft.com. This makes crawl, body-fetch, and both API surfaces
  fully exercisable offline (`bun test` + a scripted curl pass).
- **DB tests:** use `:memory:` or a temp-file SQLite per test; cover migration
  (seed old schema via raw SQL first), cursor paging, FTS search, body caching.
