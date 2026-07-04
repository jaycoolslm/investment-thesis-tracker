import { randomUUID } from "crypto";
import { db } from "../db/index.js";
import { holdings } from "../db/schema.js";
import { ThesisGenerationService } from "./thesis-generation.js";
import {
  runBatch,
  registerBatch,
  getBatch,
  cancelBatch,
  type BatchFailure,
} from "./batch-runner.js";
import { parseSpreadsheet, type ValidatedRow } from "./file-parser.js";

export interface BatchPreview {
  batchId: string;
  rows: ValidatedRow[];
  validCount: number;
  errorCount: number;
}

// Parsed preview rows live in memory between upload and start. Evicted after
// 24h or when the batch starts. Rows are lost on restart — re-upload to retry.
const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;
const previewCache = new Map<string, { rows: ValidatedRow[]; createdAt: number }>();

function evictExpiredPreviews(): void {
  for (const [id, entry] of previewCache) {
    if (Date.now() - entry.createdAt > PREVIEW_TTL_MS) previewCache.delete(id);
  }
}

/** Parse a spreadsheet and return a preview with validation. Caches rows in memory. */
export async function parseBulkFile(
  buffer: Buffer,
  mimeType: string,
): Promise<BatchPreview> {
  const rows = await parseSpreadsheet(buffer, mimeType);
  const batchId = randomUUID();
  const validCount = rows.filter((r) => r.valid).length;
  const errorCount = rows.filter((r) => !r.valid).length;

  evictExpiredPreviews();
  previewCache.set(batchId, { rows, createdAt: Date.now() });

  return { batchId, rows, validCount, errorCount };
}

interface BulkItem {
  holdingId: string;
  ticker: string;
  bullets: string;
}

/** Run generation for a set of holdings; the UI polls the batch registry for progress. */
function runBulkItems(batchId: string, items: BulkItem[]): Promise<void> {
  return runBatch(
    batchId,
    items,
    async (item) => {
      const service = new ThesisGenerationService();
      const thesisId = await service.generate(item.holdingId, item.bullets);
      console.log(`[bulk] SUCCESS ${item.ticker} — thesisId=${thesisId}`);
    },
    {
      concurrency: 3,
      retries: 1,
      onItemFailed: (item, error) => {
        console.error(`[bulk] FAILED ${item.ticker} — ${error}`);
      },
    },
  ).then((state) => {
    if (state.status === "complete") {
      console.log(
        `[bulk] Batch ${batchId} finished: ${state.completed}/${state.total} complete, ${state.failed} failed`,
      );
    }
  });
}

/** Create holdings + start in-process generation for a batch. */
export async function startBulkGeneration(
  batchId: string,
  excludeRows: number[] = [],
): Promise<{ totalJobs: number; holdingIds: string[]; done: Promise<void> }> {
  const cached = previewCache.get(batchId);
  if (!cached) {
    throw new Error("Batch not found or expired. Please upload again.");
  }

  const rows = cached.rows.filter(
    (r) => r.valid && !excludeRows.includes(r.rowNumber),
  );

  if (rows.length === 0) {
    throw new Error("No valid rows to generate.");
  }

  // Create holdings in a single transaction
  const createdHoldings = await db.transaction(async (tx) => {
    const created = [];
    for (const row of rows) {
      const [holding] = await tx
        .insert(holdings)
        .values({
          ticker: row.ticker!,
          companyName: row.companyName || row.ticker!,
          direction: row.direction!,
        })
        .returning();
      created.push({ ...holding, bullets: row.bullets! });
    }
    return created;
  });

  previewCache.delete(batchId);
  registerBatch(batchId, "bulk", createdHoldings.length);

  const done = runBulkItems(
    batchId,
    createdHoldings.map((h) => ({
      holdingId: h.id,
      ticker: h.ticker,
      bullets: h.bullets,
    })),
  ).catch((err) => {
    console.error(`[bulk] Batch ${batchId} runner crashed:`, err);
  });

  return {
    totalJobs: createdHoldings.length,
    holdingIds: createdHoldings.map((h) => h.id),
    done,
  };
}

/** Get current batch state from the in-memory registry. */
export function getBatchState(batchId: string) {
  const state = getBatch(batchId);
  if (!state) return null;

  return {
    total: state.total,
    completed: state.completed,
    failed: state.failed,
    status: state.status,
    failures: state.failures,
    startedAt: state.startedAt,
  };
}

/** Cancel remaining unstarted items. Returns the count that will not run. */
export function cancelBulkGeneration(batchId: string): number {
  const state = getBatch(batchId);
  if (!state) return 0;
  const remaining = state.total - state.completed - state.failed;
  cancelBatch(batchId);
  return Math.max(0, remaining);
}

/** Re-run failed holdings under the same batch id. */
export function retryBulkGeneration(
  batchId: string,
  holdingIds?: string[],
): { retryCount: number; holdingIds: string[]; done: Promise<void> } | null {
  const state = getBatch(batchId);
  if (!state) return null;

  let failuresToRetry: BatchFailure[] = state.failures;
  if (holdingIds) {
    const ids = new Set(holdingIds);
    failuresToRetry = failuresToRetry.filter((f) => ids.has(f.holdingId));
  }

  if (failuresToRetry.length === 0) {
    return { retryCount: 0, holdingIds: [], done: Promise.resolve() };
  }

  // Reset counters for the retried items and re-activate the batch
  state.failures = state.failures.filter(
    (f) => !failuresToRetry.some((r) => r.holdingId === f.holdingId),
  );
  state.failed = state.failures.length;
  state.total = state.completed + state.failed + failuresToRetry.length;
  state.status = "active";

  const done = runBulkItems(
    batchId,
    failuresToRetry.map((f) => ({
      holdingId: f.holdingId,
      ticker: f.ticker,
      bullets: "", // bullets were consumed at initial generation; agent re-reads the holding
    })),
  ).catch((err) => {
    console.error(`[bulk] Retry for batch ${batchId} crashed:`, err);
  });

  return {
    retryCount: failuresToRetry.length,
    holdingIds: failuresToRetry.map((f) => f.holdingId),
    done,
  };
}
