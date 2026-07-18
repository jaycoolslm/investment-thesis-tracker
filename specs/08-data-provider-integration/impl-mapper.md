# Implementation Brief — Mapping Agent (eve)

A small scheduled agent that maps newly crawled articles onto portfolio holdings and
uploads matched articles to the tracker as documents. Built on the **eve framework**
(filesystem-first durable agents), **pinned at the current preview version (0.25.x —
pin exactly, eve is pre-GA)**. Read `README.md`, `contracts.md` (§1, §3, §4, §5), and
`shared-types.ts` first. Suggested location: `~/cowork/finance/thesis-mapper`.

Before writing any code, read eve's bundled docs — they are the source of truth and
match the installed version: `node_modules/eve/docs/README.md` (reading order),
then `getting-started.mdx`, `agent-config.md`, `tools/`, `connections/mcp.mdx`,
`schedules.mdx`.

## Project layout

```
thesis-mapper/
  package.json                 # engines.node 24.x; deps: eve (pinned), ai, zod
  .env / .env.example          # TRACKER_BASE_URL, DATA_PROVIDER_URL, model key,
                               # MAPPER_LOOKBACK_HOURS, MAPPER_DRY_RUN
  shared-types.ts              # copied from this spec directory (keep header)
  agent/
    agent.ts                   # defineAgent({ model: … })
    instructions.md            # the mapping brief (below)
    connections/
      data-provider.ts         # MCP connection → http://localhost:3002/mcp
                               #  (dashes required: eve 0.25.1 rejects underscores
                               #   in connection names)
    tools/
      list_active_holdings.ts  # GET  {TRACKER}/api/holdings?status=active
                               #  + per holding GET /api/holdings/:id/thesis
                               #  → [{id,ticker,companyName,direction,thesisExcerpt}]
                               #  (skip holdings whose thesis GET returns 404;
                               #   excerpt = first 1500 chars of content)
      list_holding_documents.ts# GET {TRACKER}/api/holdings/:id/documents
                               #  → [{filename}] (for idempotency checks)
      upload_article_document.ts# builds the markdown file (frontmatter per
                               #  contracts.md §5) and POSTs multipart
                               #  (field "file", mimetype text/markdown,
                               #  filename article__<source>__<id>.md).
                               #  Refuses (returns an explanatory error) if the
                               #  filename already exists for that holding —
                               #  re-check inside the tool, don't trust the model.
                               #  MAPPER_DRY_RUN=true → log and return
                               #  {dryRun:true} instead of POSTing.
  agent/schedules/
    map_articles.md            # cron: "0 7 * * *" + the run prompt (below)
```

Notes on the eve specifics:
- Tool filenames are snake_case and become the tool names the model sees
  (`defineTool` from `eve/tools`, Zod input schemas). Tools run in the app runtime
  with full `process.env` — env handling lives in tools, never in prompts.
- The MCP connection uses `defineMcpClientConnection` from `eve/connections` with
  `url: \`${process.env.DATA_PROVIDER_URL}/mcp\``, a model-facing `description`
  ("Financial news article store: list, search, and fetch crawled articles"), and
  **no `auth`** (localhost server). The connection name comes from the filename and
  must use dashes (eve 0.25.1 rejects underscores in connection names), so
  discovered tools are called as `data-provider__list_new_articles` etc.
- The schedule is a plain `.md` file: frontmatter `cron: "0 7 * * *"` (one hour after
  the provider's 06:00 crawl), body = run prompt. Markdown schedules are
  fire-and-forget task mode, which is exactly right here. **eve only fires schedules
  from a built app (`eve build` then `eve start`) — never in `eve dev`.** For manual
  runs during development, use eve's dev dispatch route or just message the agent the
  run prompt.
- `agent.ts`: pick one model and wire its credential (e.g.
  `model: "anthropic/claude-sonnet-5"` via AI Gateway, or a direct provider model —
  see eve's `agent-config.md`). Model choice is a config line; that swappability is
  a design goal, so don't scatter model assumptions elsewhere.

## instructions.md — required content

The always-on system prompt must convey:

1. **Role**: "You map newly published financial news articles onto the holdings of a
   fund manager's portfolio. For each article that is genuinely relevant to a
   holding's investment thesis, you save it to that holding so the weekly thesis
   review reads it."
2. **Relevance judgment — the core skill.** Judge relevance to the *thesis*, not by
   name matching. Must include the canonical example: *a portfolio holds Exxon Mobil
   (XOM); an article about Chevron writing down Permian assets does not mention
   Exxon, but it is thesis-relevant read-across for XOM's Permian-led production
   pillar — match it.* Also the converse guard: an article that merely mentions the
   ticker in passing (e.g. XOM listed in a market-wrap table) is NOT relevant.
   Direction matters: for a short thesis, positive company news is still relevant
   (it challenges the thesis).
3. **Threshold**: match only articles a fund manager would actually want in the
   weekly review — expect most articles to match zero holdings, and zero matches on
   a quiet day is a correct outcome. When unsure, lean toward skipping; the weekly
   run's own web search is the safety net.
4. **Rationale**: for every match write 1–2 sentences that reference the specific
   part of the thesis affected (this text is later read by the weekly analysis
   agent as evidence framing).
5. **Procedure + idempotency**: check `list_holding_documents` before uploading;
   never upload the same article twice to the same holding; if the body fetch fails,
   upload the teaser-only document per contracts.md §5.

## Run prompt (schedule body) — required steps

1. Call `list_active_holdings`. If empty, finish.
2. Call `data-provider__list_new_articles` with
   `since = now − MAPPER_LOOKBACK_HOURS` (default 48 h), paging via `nextCursor`
   until exhausted.
3. Judge every (article, holding) pair per the instructions; collect matches.
4. For each match: `list_holding_documents` → skip if
   `article__<source>__<id>.md` already present; otherwise
   `data-provider__get_article_body` (tolerate failure → teaser-only), then
   `upload_article_document`.
5. Finish with a one-line summary (articles seen / matches / uploads / skips). No
   channel delivery needed.

**Why a 48 h lookback instead of a stored cursor:** the daily runs overlap by design;
deterministic filenames + the pre-upload existence check make reprocessing harmless,
which removes all cursor-persistence state from the agent. Crash recovery is
automatic (next run re-covers the window). The cost is re-judging up to one day of
articles; acceptable at current volumes.

## Out of scope

- Triggering any analysis in the tracker (the weekly cron picks documents up).
- Writing to the provider (MCP tools are read/fetch-cache only).
- Deleting or updating previously uploaded documents.
- Channels (Slack/web chat), subagents, HITL approval — add later only if wanted.
- Multi-model routing, evals beyond the fixture run below.

## Acceptance criteria

1. `eve build && eve start` with all env set runs the daily schedule; against live
   provider + tracker, a run completes and uploads only new matches.
2. **Idempotency**: running the same window twice produces zero duplicate documents
   (verify via `GET /api/holdings/:id/documents` — filenames unique).
3. Uploaded files validate against contracts.md §5: YAML frontmatter with
   `kind: mapped-article`, correct `article_key`, `url`, `matched_at`, non-empty
   thesis-specific `rationale`; body present when the provider had it.
4. **Nuance eval**: with a fixture holding "Exxon Mobil, long, Permian-growth thesis
   excerpt" and fixture articles (a) "Chevron writes down Permian acreage",
   (b) "Nvidia earnings beat", (c) market-wrap listing XOM among 50 tickers —
   the agent matches (a) only. Run this as a scripted check (eve evals or a manual
   dispatch against mock servers) before first real deployment.
5. Body-fetch failure (provider returns the MCP error) still yields a teaser-only
   upload with the "Full text unavailable" line.
6. `MAPPER_DRY_RUN=true` performs zero POSTs while logging intended uploads.

## Standalone testing

Neither real app is required:
- **Mock tracker + mock provider**: two tiny fixture servers (plain `node:http` or
  Bun) implementing just the endpoints/tools in contracts.md §2–4 with canned data —
  the provider mock can reuse the MCP SDK with in-memory fixtures. Point
  `TRACKER_BASE_URL`/`DATA_PROVIDER_URL` at them.
- Unit-test the three tools directly (they're plain functions): multipart encoding,
  frontmatter serialization (quote/escape the rationale), filename derivation via
  `mappedArticleFilename()` from `shared-types.ts`, existence-check refusal,
  dry-run mode.
- Iterate on prompts in `eve dev` by pasting the run-prompt; remember schedules
  don't fire in dev.
