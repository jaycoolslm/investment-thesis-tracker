# ADR 0001: Single-pass mapping agent judges all (article, holding) pairs in one run

## Status

Accepted

## Context

The `thesis-mapper` eve agent (see `specs/08-data-provider-integration/`) runs
daily on a schedule (`agent/schedules/map_articles.md`). Each run must decide,
for every newly crawled article and every active holding, whether the article
is relevant to that holding's thesis.

Two shapes were possible:

- **Single-pass (chosen):** one agent session per scheduled run. It calls
  `list_active_holdings` once, fetches the full new-article window once, and
  judges every `(article, holding)` pair itself inside one context before
  uploading matches.
- **Per-holding:** one agent session per active holding, each independently
  re-fetching/re-paging the same article window and making its own relevance
  judgments.

## Decision

Use the single-pass shape: one agent run per schedule, reasoning over all
holdings × all articles in a single context.

## Why

For a self-hosted, single-user portfolio, the expected volume is small — a
personal holdings list (tens, not hundreds) against one crawled source's daily
output (currently FT teasers only, a few hundred articles/day at most). At that
scale:

- One model call per day is cheaper and simpler than N model calls (one per
  holding), and avoids re-fetching/re-paging the identical article window N
  times from the data provider.
- The instructions already push toward selectivity ("expect most articles to
  match zero holdings"), so the actual judged surface is small even though the
  agent considers every pair.

The tradeoff is prompt size: judging holdings × articles in one context scales
worse than per-holding sessions if either dimension grows substantially.

## Consequences / what to monitor

Revisit this if either of the following happens:

- **Holdings count grows a lot** (e.g. beyond ~30-50 active holdings), or
- **Article volume grows a lot** (e.g. additional providers — broker portals,
  more sources — added per the roadmap in `specs/08-data-provider-integration/README.md`),

such that a single run's context becomes unwieldy, judgment quality degrades,
or the daily run starts taking too long / getting truncated.

If that happens, the natural fix is to split the schedule prompt into one
sub-run per holding (or batch holdings into groups) — this only requires
changing `agent/schedules/map_articles.md` and the run procedure; the tools
(`list_active_holdings`, `data-provider__list_new_articles`,
`upload_article_document`) and the tracker/provider contracts do not need to
change.

No code change is being made now — this ADR exists to record the tradeoff and
the trigger conditions for reconsidering it.
