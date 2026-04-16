import { Queue } from "bullmq";
import { Redis } from "ioredis";
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

// ---------- Weekly Monitoring Queue ----------

export const monitoringQueue = new Queue("weekly-monitoring", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export interface MonitoringJobData {
  weekLabel: string;
  holdingId: string;
  ticker: string;
}

/** Enqueue one monitoring job per holding for a weekly batch. */
export async function enqueueMonitoringBatch(
  weekLabel: string,
  items: Omit<MonitoringJobData, "weekLabel">[],
): Promise<void> {
  const jobs = items.map((item) => ({
    name: `monitor-${item.ticker}`,
    data: { weekLabel, ...item } satisfies MonitoringJobData,
  }));

  await monitoringQueue.addBulk(jobs);
}

export interface MonitoringBatchState {
  total: number;
  completed: number;
  failed: number;
  status: "active" | "complete";
  startedAt: string;
}

/** Read batch state from Redis. Returns null if no batch exists. */
export async function getMonitoringBatchState(
  weekLabel: string,
): Promise<MonitoringBatchState | null> {
  const raw = await redisConnection.hgetall(
    `monitoring:batch:${weekLabel}`,
  );
  if (!raw.status) return null;

  return {
    total: parseInt(raw.total, 10),
    completed: parseInt(raw.completed, 10),
    failed: parseInt(raw.failed, 10),
    status: raw.status as "active" | "complete",
    startedAt: raw.startedAt,
  };
}

/** Cancel remaining waiting/delayed monitoring jobs for a week. */
export async function cancelMonitoringBatch(
  weekLabel: string,
): Promise<number> {
  const waiting = await monitoringQueue.getJobs(["waiting", "delayed"]);
  let cancelled = 0;

  for (const job of waiting) {
    if (job.data?.weekLabel === weekLabel) {
      await job.remove();
      cancelled++;
    }
  }

  return cancelled;
}
