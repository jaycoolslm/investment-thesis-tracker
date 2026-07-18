# ADR 0002: Weekly analysis reads all historic documents for a holding, unfiltered by age

## Status

Accepted

## Context

`WeeklyMonitoringService.monitorHolding` (`src/services/weekly-monitoring.ts`)
loads a holding's documents with no date filter:

```ts
const docs = await db.select().from(documents).where(eq(documents.holdingId, holdingId));
```

Every document ever attached to the holding — manually uploaded broker
research **and** every `article__*.md` file the `thesis-mapper` agent has ever
matched — is passed as `researchFilePaths` into the "CONTEXT DOCUMENTS"
section of both the generation prompt and the weekly prompt
(`src/agent/prompts.ts`), every run, in full. There is no mechanism to age out
or filter matched articles by recency, even though `article__*.md` frontmatter
carries a `published_at` field that could support one.

Two shapes were possible:

- **Unbounded (chosen):** always send every document for the holding.
- **Windowed:** filter `article__*.md` documents to roughly the last N weeks
  (broker research PDFs, which are infrequent and manually curated, would
  still always be included).

## Decision

Keep sending all documents for the holding, unfiltered by age, for both
generation and weekly-analysis prompts.

## Why

This was already the existing behavior for manually uploaded broker research
(infrequent, low volume) before the data-provider integration
(`specs/08-data-provider-integration/`) added the mapper as a second source of
documents. For a self-hosted single-user setup with one crawled source (FT)
and a selective mapping agent (see [ADR 0001](0001-single-pass-article-mapping-agent.md),
which is instructed to expect most articles to match zero holdings), the
expected accumulation rate of `article__*.md` files per holding is low. Adding
a recency filter now is unwarranted complexity for a problem that may not
materialize, and re-reading an old, already-digested article is cheap noise,
not a correctness issue.

## Consequences / what to monitor

Revisit this if `article__*.md` documents accumulate faster than expected —
e.g. more crawled sources are added (broker portals, per the roadmap in
`specs/08-data-provider-integration/README.md`), or a holding ends up with
dozens of matched articles after months of daily runs — such that:

- prompt cost/latency for generation or weekly analysis grows noticeably, or
- stale articles from months ago start diluting "this week's evidence" in the
  agent's summaries, since the prompt has no signal that tells it to weight
  recent articles over old ones.

If that happens, the natural fix is a small filter in
`WeeklyMonitoringService.monitorHolding` (and the equivalent generation-time
document load) restricting `article__*.md` documents to a recent window using
their `published_at` frontmatter, while always including broker research PDFs
regardless of age. This does not require any change to the mapper, the
provider, or the document-upload contract.

No code change is being made now — this ADR exists to record the tradeoff and
the trigger conditions for reconsidering it.
