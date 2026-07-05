import cron, { type ScheduledTask } from "node-cron";
import { and, eq, notExists } from "drizzle-orm";
import { db } from "../db/index.js";
import { holdings, theses, weeklyLogs } from "../db/schema.js";
import {
  runBatch,
  registerBatch,
  getBatch,
} from "../services/batch-runner.js";
import { EmailService } from "../services/email.js";
import {
  getCurrentWeek,
  WeeklyMonitoringService,
} from "../services/weekly-monitoring.js";
import { config } from "../config.js";

let cronJob: ScheduledTask | null = null;

export function monitoringBatchId(weekLabel: string): string {
  return `monitoring:${weekLabel}`;
}

/**
 * Run a weekly monitoring batch for all active holdings that have a thesis
 * and no weekly log for the current week yet. The "no log this week" filter
 * makes re-triggering idempotent and resumes a crashed batch for free.
 * Returns null if a batch is already running or there is nothing to do.
 */
export async function runMonitoringBatch(): Promise<{
  weekLabel: string;
  total: number;
  done: Promise<void>;
} | null> {
  const { weekLabel } = getCurrentWeek();
  const batchId = monitoringBatchId(weekLabel);

  if (getBatch(batchId)?.status === "active") {
    console.log(`[scheduler] Batch for ${weekLabel} already running, skipping`);
    return null;
  }

  const pending = await db
    .selectDistinct({ id: holdings.id, ticker: holdings.ticker })
    .from(holdings)
    .innerJoin(theses, eq(theses.holdingId, holdings.id))
    .where(
      and(
        eq(holdings.status, "active"),
        notExists(
          db
            .select()
            .from(weeklyLogs)
            .where(
              and(
                eq(weeklyLogs.holdingId, holdings.id),
                eq(weeklyLogs.weekLabel, weekLabel),
              ),
            ),
        ),
      ),
    );

  if (pending.length === 0) {
    console.log(`[scheduler] Nothing to monitor for ${weekLabel}`);
    return null;
  }

  registerBatch(batchId, "monitoring", pending.length);

  const done = runBatch(
    batchId,
    pending.map((h) => ({ holdingId: h.id, ticker: h.ticker })),
    async (item) => {
      const service = new WeeklyMonitoringService();
      const logId = await service.monitorHolding(item.holdingId);
      console.log(`[scheduler] SUCCESS ${item.ticker} — logId=${logId}`);
    },
    {
      concurrency: config.MONITORING_CONCURRENCY,
      retries: 2,
      onItemFailed: (item, error) => {
        console.error(`[scheduler] FAILED ${item.ticker} — ${error}`);
      },
    },
  )
    .then(async (state) => {
      if (state.status !== "complete") return;
      console.log(
        `[scheduler] Batch ${weekLabel} finished: ${state.completed}/${state.total} complete, ${state.failed} failed`,
      );
      // Single-process runner resolves once, so the digest fires exactly once.
      if (state.completed > 0) {
        try {
          await new EmailService().sendWeeklyDigest(weekLabel);
        } catch (err) {
          console.error("[email] Failed to send digest:", err);
        }
      }
    })
    .catch((err) => {
      console.error(`[scheduler] Batch ${weekLabel} runner crashed:`, err);
    });

  console.log(
    `[scheduler] Started ${pending.length} monitoring jobs for ${weekLabel}`,
  );
  return { weekLabel, total: pending.length, done };
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
