import { randomUUID } from "crypto";
import { db } from "../db/index.js";
import { holdings } from "../db/schema.js";
import { redisConnection, enqueueBatch } from "../jobs/queue.js";
import { parseSpreadsheet, type ValidatedRow } from "./file-parser.js";

export interface BatchPreview {
  batchId: string;
  rows: ValidatedRow[];
  validCount: number;
  errorCount: number;
}

/** Parse a spreadsheet and return a preview with validation. Caches rows in Redis. */
export async function parseBulkFile(
  buffer: Buffer,
  mimeType: string,
): Promise<BatchPreview> {
  const rows = await parseSpreadsheet(buffer, mimeType);
  const batchId = randomUUID();
  const validCount = rows.filter((r) => r.valid).length;
  const errorCount = rows.filter((r) => !r.valid).length;

  // Cache parsed rows in Redis for the start endpoint (TTL 30 min)
  await redisConnection.set(
    `batch:${batchId}:rows`,
    JSON.stringify(rows),
    "EX",
    1800,
  );

  return { batchId, rows, validCount, errorCount };
}

/** Create holdings + enqueue generation jobs for a batch. */
export async function startBulkGeneration(
  batchId: string,
  excludeRows: number[] = [],
): Promise<{ totalJobs: number; holdingIds: string[] }> {
  // Read cached rows
  const cached = await redisConnection.get(`batch:${batchId}:rows`);
  if (!cached) {
    throw new Error("Batch not found or expired. Please upload again.");
  }

  const allRows: ValidatedRow[] = JSON.parse(cached);
  const rows = allRows.filter(
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

  // Initialise batch state in Redis
  const multi = redisConnection.multi();
  multi.hset(`batch:${batchId}`, {
    total: String(createdHoldings.length),
    completed: "0",
    failed: "0",
    status: "active",
  });
  multi.expire(`batch:${batchId}`, 86400); // 24h TTL
  multi.expire(`batch:${batchId}:rows`, 86400);
  await multi.exec();

  // Enqueue generation jobs
  await enqueueBatch(
    batchId,
    createdHoldings.map((h) => ({
      holdingId: h.id,
      ticker: h.ticker,
      companyName: h.companyName,
      direction: h.direction,
      bullets: h.bullets,
    })),
  );

  return {
    totalJobs: createdHoldings.length,
    holdingIds: createdHoldings.map((h) => h.id),
  };
}

/** Get current batch state from Redis. */
export async function getBatchState(batchId: string) {
  const state = await redisConnection.hgetall(`batch:${batchId}`);
  if (!state || Object.keys(state).length === 0) return null;

  const failures = await redisConnection.lrange(
    `batch:${batchId}:failures`,
    0,
    -1,
  );

  return {
    total: parseInt(state.total, 10),
    completed: parseInt(state.completed, 10),
    failed: parseInt(state.failed, 10),
    status: state.status as "active" | "complete" | "cancelled",
    failures: failures.map((f: string) => JSON.parse(f)),
  };
}
