# Spec 04 — Replace BullMQ + Redis with an in-process batch runner

<!--
  Simplification programme — spec 4 of 7. Assumes specs 01–03 landed. Runs BEFORE
  spec 05 (SSE → polling) deliberately: this spec introduces the in-memory batch
  progress store that spec 05's polling endpoints will read. Keep the existing
  progressEmitter/SSE surface WORKING in this spec — spec 05 deletes it.
-->

## Context

The job layer is distributed-systems infrastructure running as a monolith: BullMQ +
Redis + two ~95%-duplicated workers + hand-rolled Redis batch hashes + an in-process
EventEmitter that couples workers to the API process anyway. Known defects: batch
state tracked in three places; a duplicate-fire race on the "batch complete" check
(can send the email digest twice); `cancelBatch` scanning the whole queue; bulk
preview rows expiring from Redis after 30 minutes. Crash-safety here genuinely comes
from idempotency (unique `(holding_id, week_label)` index; "which holdings lack a
thesis") — not from queue persistence. Replace the whole layer with a small
in-process concurrency runner and Postgres/in-memory state. The workload (hundreds
of holdings, all I/O-bound agent calls at concurrency 3–10) does not need more.

## Existing implementation & what changes

**Keep (reuse as-is):**
- `node-cron` scheduling in `src/jobs/scheduler.ts` (the cron wrapper stays; only
  what `runMonitoringBatch` does inside changes).
- `ThesisGenerationService.generate()` and
  `WeeklyMonitoringService.monitorHolding()` — the units of work are unchanged.
- The `progressEmitter` event names and payload shapes currently consumed by the SSE
  routes and frontend hooks (`progress`, `holding_complete`, `holding_failed`,
  `batch_complete`, `monitoring:digest`) — the new runner emits the same events so
  the existing UI keeps working until spec 05.
- The email digest trigger on batch completion (fired exactly once — see criteria).
- `GET /api/monitoring/history` (already Postgres-derived; untouched).

**Add:**
- `src/services/batch-runner.ts` (~80–120 lines incl. types), one generic module:
  - `runBatch<T>(items: T[], work: (item: T) => Promise<void>, opts: { concurrency:
    number; retries: number; onItemDone; onItemFailed }): Promise<BatchResult>` — a
    plain semaphore/worker-pool loop with per-item retry (simple delay backoff is
    fine). No new dependency; ~30 lines of pooling is enough. Do NOT add p-limit,
    p-queue, or any queue library.
  - An in-memory **batch registry**: `Map<string, BatchState>` where `BatchState =
    { kind: 'bulk' | 'monitoring', total, completed, failed, failures: Array<{
    holdingId, ticker, error }>, status: 'active' | 'complete' | 'cancelled',
    startedAt }`, with `getBatch(id)`, plus a `cancel(id)` flag the runner checks
    before starting each remaining item. Because this is single-process, the
    "batch finished" check is race-free — completion fires exactly once.
- Server-restart story (documented in `CLAUDE.md`): in-flight batches die with the
  process; re-triggering resumes safely because the work is idempotent (monitoring
  skips holdings already logged this week; bulk retry re-runs holdings whose
  generation failed). No boot-time auto-resume in this spec.

**Change:**
- `src/services/bulk-generation.ts`: preview rows cached in an in-memory Map (keyed
  by batchId, entries evicted after ~24 h or on `start`) instead of Redis;
  `startBulkGeneration` creates holdings then calls `runBatch` (concurrency 3,
  retries 1); `getBatchState` reads the registry; cancel sets the registry flag. The
  bulk retry endpoint re-runs the failed holdings through `runBatch` under the same
  batch id semantics the frontend already expects.
- `src/jobs/scheduler.ts` → fold into `src/services/` or keep path (your call, note
  it in CLAUDE.md): `runMonitoringBatch` selects **active holdings that have a
  thesis and no weekly log for the current week** (this replaces the Redis `hsetnx`
  idempotency lock AND gives resume-on-retrigger for free), registers a batch keyed
  by `weekLabel`, and calls `runBatch` (concurrency `config.MONITORING_CONCURRENCY`,
  retries 2).
- `GET /api/monitoring/status`: current/most-recent week from the registry; if the
  registry has nothing (fresh process), derive a completed-batch summary from
  `weekly_logs` for the current week (and previous week fallback, as today).
- `src/config.ts` + `.env.example`: remove `REDIS_URL`; keep
  `MONITORING_CONCURRENCY`, `MONITORING_CRON_SCHEDULE`.

**Remove (completely):**
- `src/jobs/queue.ts`, `src/jobs/bulk-worker.ts`, `src/jobs/weekly-worker.ts`, and
  wherever the workers were imported/started (`server.ts`/`app.ts`).
- Deps: `bullmq`, `ioredis` (`pnpm remove`).
- `redis` service from `docker-compose.yml` (and the host-port-6380 note in
  CLAUDE.md); any Redis wait/health logic in the Dockerfile or compose.
- `@testcontainers/redis` and the Redis container from
  `src/__tests__/setup-integration.ts`; integration tests that asserted Redis batch
  hashes get rewritten against the registry/endpoints.

## Acceptance criteria

1. `grep -ri "bullmq\|ioredis\|redis" src/ web/src/ docker-compose.yml Dockerfile
   package.json CLAUDE.md README.md .env.example` returns nothing (a historical
   mention in CLAUDE.md's status paragraph explaining the removal is allowed).
2. `docker compose up -d --build` starts **api + postgres only**, healthy.
3. Bulk flow end-to-end with `MOCK_AGENT=true` (e2e `bulk-upload.spec.ts` updated as
   needed): upload → preview → start → progress advances → completion state with
   correct completed/failed counts; a failure injected via mock (or a unit test on
   `runBatch`) shows retry-then-fail-once accounting — `failed` increments once per
   item, never per attempt.
4. Monitoring flow end-to-end (`monitoring-flow.spec.ts`): trigger → progress → logs
   written → dashboard badges update → history endpoint unchanged. Triggering twice
   in the same week: the second trigger reports nothing to do (or completes with 0
   items) and does NOT duplicate weekly logs — assert the `(holding, week)` count.
5. Exactly-once completion: a unit test on `runBatch` with concurrent finishing items
   asserts `batch_complete`/digest callback fires once.
6. Cancel: cancelling mid-batch stops unstarted items, marks state `cancelled`, and
   the UI reflects it (existing cancel button keeps working).
7. `runBatch` + registry live in one file under ~150 lines total; no new deps.
8. All four suites green; integration setup boots Postgres Testcontainer only.

## Out of scope

- Removing SSE / progressEmitter (spec 05 — they must keep working here).
- The email digest feature itself (spec 07 decides its fate; here it just must not
  fire twice).
