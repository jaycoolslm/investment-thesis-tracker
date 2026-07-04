/**
 * In-process batch runner + registry. The workload is hundreds of I/O-bound
 * agent calls at concurrency 3–10, all idempotent, so a plain worker-pool
 * loop with in-memory state is enough — no queue infrastructure. Single-process
 * means the "batch finished" transition happens exactly once, race-free.
 *
 * In-flight batches die with the process; re-triggering resumes safely because
 * the underlying work is idempotent (see CLAUDE.md).
 */

export interface BatchFailure {
  holdingId: string;
  ticker: string;
  error: string;
}

export interface BatchState {
  kind: "bulk" | "monitoring";
  total: number;
  completed: number;
  failed: number;
  failures: BatchFailure[];
  status: "active" | "complete" | "cancelled";
  startedAt: string;
}

export interface BatchItem {
  holdingId: string;
  ticker: string;
}

const REGISTRY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // keep finished batches 7 days

const registry = new Map<string, BatchState>();

/** Create (or reset) a batch entry. Evicts stale finished batches as it goes. */
export function registerBatch(
  id: string,
  kind: BatchState["kind"],
  total: number,
): BatchState {
  for (const [key, state] of registry) {
    if (
      state.status !== "active" &&
      Date.now() - new Date(state.startedAt).getTime() > REGISTRY_TTL_MS
    ) {
      registry.delete(key);
    }
  }

  const state: BatchState = {
    kind,
    total,
    completed: 0,
    failed: 0,
    failures: [],
    status: "active",
    startedAt: new Date().toISOString(),
  };
  registry.set(id, state);
  return state;
}

export function getBatch(id: string): BatchState | null {
  return registry.get(id) ?? null;
}

/** Test helper: wipe all batch state between tests. */
export function clearRegistry(): void {
  registry.clear();
}

/** Flag a batch as cancelled; the runner checks this before starting each remaining item. */
export function cancelBatch(id: string): boolean {
  const state = registry.get(id);
  if (!state || state.status !== "active") return false;
  state.status = "cancelled";
  return true;
}

export interface RunBatchOpts<T> {
  concurrency: number;
  /** Extra attempts after the first failure (retries: 1 → up to 2 attempts). */
  retries: number;
  retryDelayMs?: number;
  onItemDone?: (item: T) => void;
  onItemFailed?: (item: T, error: string) => void;
}

/**
 * Run `work` over `items` with a bounded worker pool and per-item retry.
 * Counters are per-item: `failed` increments once per item, never per attempt.
 * Resolves exactly once with the final batch state.
 */
export async function runBatch<T extends BatchItem>(
  batchId: string,
  items: T[],
  work: (item: T) => Promise<void>,
  opts: RunBatchOpts<T>,
): Promise<BatchState> {
  const state = registry.get(batchId);
  if (!state) throw new Error(`Batch ${batchId} is not registered`);

  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      if (state!.status === "cancelled") return;
      const index = next++;
      if (index >= items.length) return;
      const item = items[index];

      let lastError = "Unknown error";
      let succeeded = false;
      for (let attempt = 0; attempt <= opts.retries; attempt++) {
        try {
          await work(item);
          succeeded = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt < opts.retries) {
            await new Promise((r) =>
              setTimeout(r, (opts.retryDelayMs ?? 1000) * (attempt + 1)),
            );
          }
        }
      }

      if (succeeded) {
        state!.completed++;
        opts.onItemDone?.(item);
      } else {
        state!.failed++;
        state!.failures.push({
          holdingId: item.holdingId,
          ticker: item.ticker,
          error: lastError,
        });
        opts.onItemFailed?.(item, lastError);
      }
    }
  }

  const poolSize = Math.max(1, Math.min(opts.concurrency, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  if (state.status === "active") state.status = "complete";
  return state;
}
