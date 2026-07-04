/**
 * In-memory progress store for single-thesis generation. The frontend polls
 * GET /api/holdings/:id/generation-status instead of holding an SSE stream,
 * so a reload mid-generation resumes showing progress for free.
 */

export interface GenerationProgressState {
  status: "running" | "complete" | "failed";
  startedAt: string;
  /** Human-readable activity lines (capped at the most recent MAX_EVENTS). */
  events: string[];
  error?: string;
}

const MAX_EVENTS = 50;
const FINISHED_TTL_MS = 10 * 60 * 1000; // evict finished entries after 10 min

interface Entry {
  state: GenerationProgressState;
  finishedAt: number | null;
}

const store = new Map<string, Entry>();

function evictExpired(): void {
  for (const [id, entry] of store) {
    if (entry.finishedAt && Date.now() - entry.finishedAt > FINISHED_TTL_MS) {
      store.delete(id);
    }
  }
}

/** Create (or reset) the progress entry for a holding's generation run. */
export function startGeneration(holdingId: string): void {
  evictExpired();
  store.set(holdingId, {
    state: {
      status: "running",
      startedAt: new Date().toISOString(),
      events: [],
    },
    finishedAt: null,
  });
}

export function appendGenerationEvent(holdingId: string, line: string): void {
  const entry = store.get(holdingId);
  if (!entry) return;
  entry.state.events.push(line);
  if (entry.state.events.length > MAX_EVENTS) {
    entry.state.events.splice(0, entry.state.events.length - MAX_EVENTS);
  }
}

export function finishGeneration(
  holdingId: string,
  status: "complete" | "failed",
  error?: string,
): void {
  const entry = store.get(holdingId);
  if (!entry) return;
  entry.state.status = status;
  if (error) entry.state.error = error;
  entry.finishedAt = Date.now();
}

export function getGenerationProgress(
  holdingId: string,
): GenerationProgressState | null {
  evictExpired();
  return store.get(holdingId)?.state ?? null;
}

/** Test helper: wipe all generation progress between tests. */
export function clearProgressStore(): void {
  store.clear();
}
