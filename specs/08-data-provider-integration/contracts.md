# Cross-Application Contracts

Every interface between the three applications. Implementers must not deviate from
these shapes without updating this file first. Canonical TypeScript types live in
`shared-types.ts` (copy it into your app).

All timestamps in every contract are **ISO 8601 UTC strings** (`new Date().toISOString()`).
All error responses in both HTTP APIs are `{ "error": string }` with an appropriate
4xx/5xx status (the tracker already follows this convention).

---

## 1. Article keys

An article is globally identified by an **article key**:

```
<source>:<native-id>
```

- `source` — lowercase provider slug. Only `"ft"` exists today.
- `native-id` — the provider's own stable id. For FT this is the content UUID from the
  teaser's `data-id` attribute (e.g. `478fe638-84d5-4eab-a2c5-5b43ec106bdf`).
- Example key: `ft:478fe638-84d5-4eab-a2c5-5b43ec106bdf`
- Keys appear in URL path segments (colons are legal in a path segment; do not
  percent-encode them).
- **Filename-safe form** (used in document filenames, where `:` is not acceptable):
  replace `:` with `__` → `ft__478fe638-84d5-4eab-a2c5-5b43ec106bdf`.

---

## 2. Data Provider — HTTP API

Base URL: `http://localhost:3002` (configurable, `DP_PORT`). No auth (localhost,
single user). Read-only except `POST /articles/:key/body`, which only triggers an
internal fetch-and-cache.

### GET /health

Always 200 when the process is up.

```jsonc
{
  "status": "ok",
  "articleCount": 145,          // total rows in articles
  "bodyCount": 12,              // rows with body cached
  "sources": [
    {
      "source": "ft",
      "lastRun": {              // most recent crawl_runs row, or null if never crawled
        "id": 7,
        "source": "ft",
        "startedAt": "2026-07-18T06:00:01.000Z",
        "finishedAt": "2026-07-18T06:03:22.000Z",  // null while running
        "articlesSeen": 140,
        "articlesNew": 9,
        "error": null           // string when the run failed
      }
    }
  ]
}
```

### GET /articles

Query params (all optional):

| Param | Type | Default | Meaning |
|---|---|---|---|
| `since` | ISO 8601 string | none | Return articles with `first_seen_at` strictly greater than this |
| `source` | string | all | Filter by source slug |
| `section` | string | all | Filter by section (`markets`, `companies`, `technology`, `us`, `alphaville`) |
| `limit` | int 1–500 | 100 | Page size |

Response 200:

```jsonc
{
  "articles": [ /* ArticleTeaser[], see shared-types.ts — no body field */ ],
  "nextCursor": "2026-07-18T06:03:20.101Z"  // max first_seen_at in this page; null when no rows
}
```

Ordered by `first_seen_at` ascending. Pass `nextCursor` back as `since` to page.
Invalid `since`/`limit` → 400.

### GET /articles/:key

200 → a full `Article` object (see `shared-types.ts`); `body` is a string if cached,
else `null`. 404 `{ "error": "Article not found" }` for unknown keys; 400 for a
malformed key (no `:`).

### POST /articles/:key/body

Fetch-and-cache the full article body from the source site. **Idempotent**: if the
body is already cached, returns it without re-fetching.

- 200 → the full `Article` with `body` populated (whether freshly fetched or cached).
- 404 → unknown key.
- 502 `{ "error": "Body fetch failed", "detail": "<message>" }` → the upstream fetch
  or parse failed (expired cookie, changed markup, network). The caller should skip
  the article and continue; the provider must not retry-loop internally.

Empty request body; no request payload is defined.

### GET /crawl-runs

Query param `limit` (int 1–100, default 20). 200 → `CrawlRun[]`, most recent first.

---

## 3. Data Provider — MCP server

- **Transport:** MCP Streamable HTTP, served by the same Bun process at
  `POST http://localhost:3002/mcp` (same port as the HTTP API, path `/mcp`).
- **Implementation:** `@modelcontextprotocol/sdk` (TypeScript SDK, runs under Bun).
- **Auth:** none.
- Server name: `data-provider`. Tools are thin wrappers over the same SQLite queries
  as the HTTP API — behavior must match the HTTP contract exactly.

Four tools. Input schemas below are the JSON Schemas to register; outputs are returned
as JSON text content matching the shapes shown.

### `list_new_articles`

List article teasers first seen after a given time. Same semantics as
`GET /articles`.

```jsonc
// input schema
{
  "type": "object",
  "properties": {
    "since":   { "type": "string", "description": "ISO 8601; return articles first seen strictly after this" },
    "source":  { "type": "string" },
    "section": { "type": "string" },
    "limit":   { "type": "integer", "minimum": 1, "maximum": 500, "default": 100 }
  }
}
// output: { "articles": ArticleTeaser[], "nextCursor": string | null }
```

### `search_articles`

Full-text search over headline + standfirst (SQLite FTS5).

```jsonc
// input schema
{
  "type": "object",
  "required": ["query"],
  "properties": {
    "query": { "type": "string", "description": "FTS5 match query, e.g. 'oil OR permian'" },
    "since": { "type": "string", "description": "ISO 8601 lower bound on first_seen_at" },
    "limit": { "type": "integer", "minimum": 1, "maximum": 100, "default": 25 }
  }
}
// output: { "articles": ArticleTeaser[] }
```

### `get_article`

```jsonc
// input schema
{ "type": "object", "required": ["key"], "properties": { "key": { "type": "string" } } }
// output: Article (body may be null) — or an MCP tool error "Article not found"
```

### `get_article_body`

Fetch-once-and-cache, identical semantics to `POST /articles/:key/body`.

```jsonc
// input schema
{ "type": "object", "required": ["key"], "properties": { "key": { "type": "string" } } }
// output: Article with body populated — or an MCP tool error on 404/fetch failure
```

Keep the tool list at exactly these four; every extra tool is prompt surface the
mapping agent must reason over.

---

## 4. Thesis Tracker — API surface used by the mapping agent

Base URL: `http://localhost:3001` (env `TRACKER_BASE_URL` in the mapper). All routes
are under `/api`. No auth. **These are existing endpoints, verified against the code**
(`src/routes/holdings.ts`, `src/routes/theses.ts`, `src/routes/documents.ts`), except
where marked NEW/CHANGED.

### GET /api/holdings?status=active  (existing)

200 → array of holdings. Relevant fields per row:

```jsonc
{
  "id": "6f0c…-uuid",
  "ticker": "XOM",
  "companyName": "Exxon Mobil",
  "direction": "long",              // "long" | "short"
  "benchmark": "S&P 500",
  "status": "active",               // filtered by the query param
  "createdAt": "2026-06-01T…",
  "latestImpact": "unchanged",      // derived; may be null
  "lastUpdated": "2026-07-13T…",    // derived; may be null
  "weakenedStreak": false
}
```

### GET /api/holdings/:id/thesis  (existing)

200 → the latest thesis row:

```jsonc
{ "id": "uuid", "holdingId": "uuid", "content": "## Summary\n…markdown…",
  "sources": [ { "title": "…", "url": "…" } ], "createdAt": "…", "updatedAt": "…" }
```

404 `{ "error": "No thesis found for this holding" }` when the holding has no thesis.
**Mapper convention:** holdings without a thesis are skipped (nothing to judge
relevance against). The *thesis excerpt* passed to the LLM is the first **1,500
characters** of `content`.

### GET /api/holdings/:id/documents  (existing)

200 → array of document rows:

```jsonc
{ "id": "uuid", "holdingId": "uuid", "filename": "article__ft__478fe638-….md",
  "filePath": "/data/documents/<holdingId>/1752…-article__ft__478fe638-….md",
  "fileType": "MD", "fileSize": 4312, "createdAt": "…" }
```

`filename` is the **original upload filename** (the on-disk `filePath` gets a
`Date.now()-` prefix from multer; ignore it). This endpoint is the mapper's
**idempotency check** — see §5.

### POST /api/holdings/:id/documents  (existing endpoint, CHANGED to accept markdown)

- `multipart/form-data`, single file part named **`file`**.
- Max size 50 MB.
- Accepted mimetypes after the tracker change: `application/pdf`,
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
  **`text/markdown`** (NEW — the mapper must send exactly this mimetype).
- 201 → the created document row (shape above; `fileType` is `"PDF" | "DOCX" | "MD"`).
- 400 `{ "error": "No file uploaded…" }` when the mimetype is rejected (multer's
  filter silently drops the file, so a rejected type surfaces as "no file").
- 404 `{ "error": "Holding not found" }`.

### GET /api/provider/health  (NEW, tracker)

Proxy to the data provider's `GET /health`, so the browser never talks cross-origin
to the provider. 200 → the provider health payload verbatim. 503
`{ "error": "Data provider unreachable" }` when the provider is down or
`DATA_PROVIDER_URL` is unset. See `impl-tracker.md`.

---

## 5. The article-as-document convention

This is how a "match" is persisted. There is **no `article_matches` table**: the
document row in the tracker's existing `documents` table *is* the mapping edge
(one row per holding × article), and the article metadata + match rationale travel
inside the file. Rationale for preferring this over a new table: the weekly agent
needs the content as a *file* anyway (it reads `researchFilePaths` natively); the
document row already carries holding linkage, filename identity, and timestamps; a
parallel table would duplicate that state and need its own API, UI, and migration
for zero additional behavior. If a structured "related articles" UI is ever wanted,
the frontmatter is machine-parseable and a table can be derived later.

### Filename (idempotency key)

```
article__<source>__<native-id>.md
```

Example: `article__ft__478fe638-84d5-4eab-a2c5-5b43ec106bdf.md`

Deterministic per article. **Before uploading, the mapper MUST call
`GET /api/holdings/:id/documents` and skip the upload if any row's `filename`
equals the target filename.** This makes the whole mapping run idempotent and
re-runnable (crashed runs, overlapping 48 h windows — see `impl-mapper.md`).

### File format

Markdown with YAML frontmatter. Frontmatter fields are fixed:

```markdown
---
kind: mapped-article
article_key: ft:478fe638-84d5-4eab-a2c5-5b43ec106bdf
source: ft
url: https://www.ft.com/content/478fe638-84d5-4eab-a2c5-5b43ec106bdf
published_at: 2026-07-17T14:02:00.000Z   # null → omit the line
matched_at: 2026-07-18T07:31:12.000Z
rationale: "Chevron's Permian writedown reads across to the thesis's Permian-led production growth pillar."
---

# <headline>

*<standfirst>*

<full article body as fetched from the provider>
```

- `rationale` is the LLM's one-to-two-sentence explanation of why this article is
  relevant to **this holding's thesis** — it is read by the weekly analysis agent as
  context, so write it referencing the thesis, not generically.
- Body comes from `get_article_body`. If the body fetch fails (502), the mapper still
  uploads the document with headline + standfirst + rationale and a line
  `> Full text unavailable; see the URL above.` — a matched teaser is still signal.
- Mimetype on upload: `text/markdown`. Content encoding UTF-8.

### How the weekly analysis consumes it (verified, no change needed beyond mimetype)

`src/services/weekly-monitoring.ts` already loads **all** rows from `documents` for
the holding and passes `docs.map(d => d.filePath)` as `researchFilePaths` into
`buildWeeklyPrompt` (`src/agent/prompts.ts`), which appends:

```
BROKER RESEARCH FILES (read these for additional context):
- /data/documents/<holdingId>/<file>
…
Incorporate relevant insights from these documents. Cite them in the sources section.
```

The Codex agent reads the files natively (it already reads PDFs; markdown is trivially
readable). Therefore the **only tracker change required for the linchpin is accepting
`text/markdown` uploads** (§4). One prompt wording tweak is specced in
`impl-tracker.md` so the agent knows some files are news articles rather than broker
research.

### Shared filesystem requirement

`filePath` values like `/data/documents/…` are paths **inside the tracker's
container/host**. The mapper never reads them — it only uploads via HTTP. No shared
volume between apps is needed.

---

## 6. Data Provider — SQLite schema

Database file: `ft.sqlite` (env `DP_DB_PATH`), WAL mode. Full target schema:

```sql
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS articles (
  source          TEXT NOT NULL DEFAULT 'ft',
  id              TEXT NOT NULL,             -- provider-native id (FT content UUID)
  section         TEXT NOT NULL,
  headline        TEXT NOT NULL,
  standfirst      TEXT,
  category        TEXT,
  category_url    TEXT,
  author          TEXT,
  author_url      TEXT,
  url             TEXT NOT NULL,
  published_at    TEXT,                      -- ISO 8601; from JSON-LD when body fetched, else NULL
  first_seen_at   TEXT NOT NULL,             -- ISO 8601, crawl time; UNIQUE per article (see invariant below)
  body            TEXT,                      -- full article text; NULL until fetched on match
  body_fetched_at TEXT,                      -- ISO 8601; NULL until fetched
  PRIMARY KEY (source, id)
);

CREATE INDEX IF NOT EXISTS idx_articles_first_seen ON articles (first_seen_at);

CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  headline, standfirst,
  content='articles', content_rowid='rowid'
);
-- Keep FTS in sync with triggers on articles (INSERT/UPDATE/DELETE), the standard
-- external-content pattern from the SQLite FTS5 docs.

CREATE TABLE IF NOT EXISTS crawl_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source        TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  articles_seen INTEGER NOT NULL DEFAULT 0,
  articles_new  INTEGER NOT NULL DEFAULT 0,
  error         TEXT
);
```

### Invariant: `first_seen_at` is unique per article

The cursor contract (§2 `GET /articles`: `since` is an exclusive lower bound,
`nextCursor` = the page's max `first_seen_at`) is only gap-free if no two articles
share a `first_seen_at`. **The provider guarantees uniqueness**: when an insert (or a
migrated legacy row) would collide with an existing timestamp, it is nudged forward
by 1 ms until unique, preserving relative ordering. This is a provider-internal
invariant; the consumer-facing cursor contract is unchanged, and consumers must not
assume `first_seen_at` is the exact wall-clock crawl time (it may be a few ms later).

### Migration from the current ft-scrape schema

Current table (from `db.ts`): `articles(id TEXT PRIMARY KEY, section, headline,
standfirst, category, category_url, author, author_url, url, first_seen_at)`.

Migration (run once at startup when the new columns are missing; SQLite can't alter
a PK, so rebuild):

```sql
BEGIN;
ALTER TABLE articles RENAME TO articles_old;
-- CREATE TABLE articles … (full new schema above)
INSERT INTO articles (source, id, section, headline, standfirst, category,
                      category_url, author, author_url, url, first_seen_at)
  SELECT 'ft', id, section, headline, standfirst, category,
         category_url, author, author_url, url, first_seen_at
  FROM articles_old;
DROP TABLE articles_old;
COMMIT;
```

Detect the old shape via `PRAGMA table_info(articles)` (no `source` column → migrate).
Note: the literal `INSERT … SELECT` above copies `first_seen_at` verbatim; the actual
migration must additionally deduplicate colliding timestamps (legacy rows share crawl
timestamps — the real DB had 145 rows across 5 timestamps) by nudging duplicates
forward 1 ms while preserving order, to establish the uniqueness invariant above.

---

## 7. Tracker Postgres deltas

**None to the schema.** No new tables, no new columns (§5 justifies dropping the
earlier `article_matches` idea). The `documents.fileType` column is `varchar(50)`
with no DB-level enum, so the new `"MD"` value needs no migration. Code-level changes
only — see `impl-tracker.md`.

---

## 8. Environment variables & config

### Data Provider (Bun)

| Var | Default | Meaning |
|---|---|---|
| `FT_COOKIE` | — (required) | The FT session cookie string (moved out of source) |
| `DP_PORT` | `3002` | HTTP + MCP port |
| `DP_DB_PATH` | `ft.sqlite` | SQLite file path |
| `DP_CRAWL_CRON` | `0 6 * * *` | Daily crawl schedule (5-field cron, local time) |

### Thesis Tracker (additions to `src/config.ts`)

| Var | Default | Meaning |
|---|---|---|
| `DATA_PROVIDER_URL` | unset (optional) | e.g. `http://localhost:3002`; when unset, `GET /api/provider/health` returns 503 and the UI hides the provider health card |

### Mapping Agent (eve)

| Var | Default | Meaning |
|---|---|---|
| `TRACKER_BASE_URL` | `http://localhost:3001` | Tracker API base |
| `DATA_PROVIDER_URL` | `http://localhost:3002` | Provider base (MCP at `/mcp`) |
| `ANTHROPIC_API_KEY` or `AI_GATEWAY_API_KEY` | — | Model credential per eve's model config |
| `MAPPER_LOOKBACK_HOURS` | `48` | Article window per run (see `impl-mapper.md`) |
| `MAPPER_DRY_RUN` | unset | `true` → log intended uploads instead of POSTing |

Mapper schedule: daily at **07:00** local (`0 7 * * *`), one hour after the provider
crawl, declared in the eve schedule file (not an env var). Note: eve fires schedules
only from a built app (`eve build` + `eve start`), never in `eve dev`.

### Ports summary

| App | Port |
|---|---|
| Tracker API | 3001 |
| Tracker frontend (dev) | 5173 |
| Data Provider (HTTP + MCP) | 3002 |
| Mapping Agent (eve HTTP route) | 3000 (eve default; only used for manual prodding) |
