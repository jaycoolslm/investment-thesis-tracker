import { Queue } from "bullmq";
import Redis from "ioredis";
import { config } from "../config.js";

// Shared connection — maxRetriesPerRequest: null is required for BullMQ workers
export const redisConnection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const bulkQueue = new Queue("bulk-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export interface BulkJobData {
  batchId: string;
  holdingId: string;
  ticker: string;
  companyName: string;
  direction: "long" | "short";
  bullets: string;
}

/** Enqueue one job per holding for a batch. */
export async function enqueueBatch(
  batchId: string,
  items: Omit<BulkJobData, "batchId">[],
): Promise<void> {
  const jobs = items.map((item) => ({
    name: `generate-${item.ticker}`,
    data: { batchId, ...item } satisfies BulkJobData,
  }));

  await bulkQueue.addBulk(jobs);
}

/** Cancel remaining waiting/delayed jobs for a batch. Returns count cancelled. */
export async function cancelBatch(batchId: string): Promise<number> {
  const waiting = await bulkQueue.getJobs(["waiting", "delayed"]);
  let cancelled = 0;

  for (const job of waiting) {
    if (job.data?.batchId === batchId) {
      await job.remove();
      cancelled++;
    }
  }

  return cancelled;
}
