# Spec 05 — Replace SSE progress streams with polling

<!--
  Simplification programme — spec 5 of 7. Assumes spec 04 landed: batch progress
  now lives in the in-memory batch registry (bulk + monitoring). This spec adds a
  small progress store for single-thesis generation, exposes plain GET status
  endpoints, deletes all SSE endpoints + the progressEmitter singleton, and swaps
  the frontend SSE hooks for TanStack Query polling.
-->

## Context

Three separate SSE systems (generation, bulk, monitoring — four endpoints counting
the per-holding weekly-log stream) plus a global `progressEmitter` EventEmitter and
four frontend EventSource hooks exist to push progress a few seconds sooner than a
poll would. Polling with TanStack Query (already used for all other data) is
simpler, survives reloads/reconnects for free, and needs no server push machinery.
The one feature worth preserving is the generation activity feed (live web-search
queries) — preserved by storing recent events and returning them from the poll.

## Existing implementation & what changes

**Keep:**
- The batch registry from spec 04 (it becomes the single source of progress truth
  for bulk + monitoring).
- `BulkProgressBanner`, `GenerationProgress`, and the general UX: progress bar, ETA,
  activity feed, cancel button. Only their data transport changes.
- `useMonitoringStatus` / `useMonitoringHistory` (already polling-style queries).

**Add:**
- Extend the batch registry module (or a sibling ~40-line `progress-store.ts`) with
  generation progress: `generation:{holdingId}` → `{ status: 'running' | 'complete'
  | 'failed', startedAt, events: string[] }` where `events` is a capped (last ~50)
  list of human-readable activity lines. `thesis-generation.ts` appends to it from
  the `runStreamed` events exactly where it currently emits SSE events. Entries
  evicted shortly after completion is observed (~10 min TTL is fine).
- `GET /api/holdings/:id/generation-status` → that object (404/idle when none).
- Bulk + monitoring already get status endpoints from spec 04
  (`getBatchState`-backed and `/api/monitoring/status`) — extend if any field the
  banners need (e.g. `currentTicker`, per-item failures) is missing.

**Change — frontend:**
- `useGenerationProgress`, `useBulkProgress`, `useMonitoringProgress`: rewrite as
  TanStack Query hooks with `refetchInterval: 2000` while status is active, stopping
  when complete/failed/cancelled (return `false` from refetchInterval). Completion
  triggers the same invalidations the SSE handlers do today (`["holdings"]` etc.).
  Keep the hook names and return shapes as close as practical so components barely
  change; ETA derived from `startedAt` + counts, as today.
- Weekly per-holding trigger (`useWeeklyMonitoring`): the POST already returns the
  completed log synchronously — drop its SSE progress subscription entirely; a
  simple pending state on the mutation suffices.

**Remove (completely):**
- `src/progress.ts` (the EventEmitter singleton) and every `progressEmitter`
  import/emit/on.
- SSE endpoints: `GET /api/holdings/:id/progress` (generation), `GET
  /api/bulk/.../progress`, `GET /api/monitoring/progress`, `GET
  /api/holdings/:id/weekly-logs/progress` — and their `text/event-stream` plumbing.
- All frontend `EventSource` usage: `grep -r "EventSource" web/src/` must end empty.
- Emit-side event forwarding in `thesis-generation.ts` / batch runner beyond the
  store writes described above.

## Acceptance criteria

1. `grep -rn "EventSource\|event-stream\|progressEmitter" src/ web/src/` returns
   nothing; `src/progress.ts` is gone.
2. Generating a thesis (mock) shows a live-updating activity feed via polling: the
   feed gains entries while running and reaches the completed state without a page
   reload; reloading mid-generation resumes showing progress (this is a behaviour
   SSE lost — assert it).
3. Bulk and monitoring banners show advancing counts + ETA while a batch runs and
   settle to their completion states; cancel still works.
4. No polling leak: when nothing is running, the network tab shows no repeating
   status requests from the dashboard (refetchInterval off when idle/complete).
5. All four suites green; e2e specs updated (they may currently wait on SSE-driven
   UI — they must pass against polling timing, without arbitrary long sleeps).
6. Net LOC down for the spec (the four SSE hooks + endpoints + emitter outweigh the
   small progress store).

## Out of scope

- Changing what progress information is shown — transport only.
- WebSockets or any push alternative.
