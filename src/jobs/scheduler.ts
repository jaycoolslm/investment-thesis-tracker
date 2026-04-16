import cron, { type ScheduledTask } from "node-cron";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { holdings, theses } from "../db/schema.js";
import {
  redisConnection,
  enqueueMonitoringBatch,
} from "./queue.js";
import { getCurrentWeek } from "../services/weekly-monitoring.js";
import { config } from "../config.js";

let cronJob: ScheduledTask | null = null;

/**
 * Run a weekly monitoring batch for all active holdings with theses.
 * Returns { weekLabel, total } if jobs were enqueued, or null if skipped
 * (batch already exists for this week or no holdings to monitor).
 */
export async function runMonitoringBatch(): Promise<{
  weekLabel: string;
  total: number;
} | null> {
  const { weekLabel } = getCurrentWeek();

  // Idempotency: atomic check-and-set prevents race conditions
  const wasSet = await redisConnection.hsetnx(
    `monitoring:batch:${weekLabel}`,
    "status",
    "active",
  );
  if (wasSet === 0) {
    console.log(
      `[scheduler] Batch for ${weekLabel} already exists, skipping`,
    );
    return null;
  }

  // Query active holdings that have at least one thesis
  const activeHoldings = await db
    .selectDistinct({ id: holdings.id, ticker: holdings.ticker })
    .from(holdings)
    .innerJoin(theses, eq(theses.holdingId, holdings.id))
    .where(eq(holdings.status, "active"));

  if (activeHoldings.length === 0) {
    // Clean up the Redis key we just set
    await redisConnection.del(`monitoring:batch:${weekLabel}`);
    console.log("[scheduler] No active holdings with theses to monitor");
    return null;
  }

  // Initialize batch state
  const multi = redisConnection.multi();
  multi.hset(`monitoring:batch:${weekLabel}`, {
    total: String(activeHoldings.length),
    completed: "0",
    failed: "0",
    startedAt: new Date().toISOString(),
  });
  multi.expire(`monitoring:batch:${weekLabel}`, 604800); // 7 days
  multi.expire(`monitoring:batch:${weekLabel}:failures`, 604800);
  await multi.exec();

  // Enqueue jobs
  await enqueueMonitoringBatch(
    weekLabel,
    activeHoldings.map((h) => ({ holdingId: h.id, ticker: h.ticker })),
  );

  console.log(
    `[scheduler] Enqueued ${activeHoldings.length} monitoring jobs for ${weekLabel}`,
  );
  return { weekLabel, total: activeHoldings.length };
}

export function startScheduler(): void {
  const schedule = config.MONITORING_CRON_SCHEDULE;

  if (!cron.validate(schedule)) {
    console.error(`[scheduler] Invalid cron expression: ${schedule}`);
    return;
  }

  cronJob = cron.schedule(schedule, async () => {
    console.log(`[scheduler] Cron triggered at ${new Date().toISOString()}`);
    try {
      await runMonitoringBatch();
    } catch (err) {
      console.error("[scheduler] Batch trigger failed:", err);
    }
  }, { noOverlap: true });

  console.log(`[scheduler] Cron scheduled: ${schedule}`);
}

export function stopScheduler(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("[scheduler] Cron stopped");
  }
}
