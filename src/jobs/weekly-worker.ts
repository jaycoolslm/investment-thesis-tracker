import { Worker } from "bullmq";
import { redisConnection, type MonitoringJobData } from "./queue.js";
import { WeeklyMonitoringService } from "../services/weekly-monitoring.js";
import { progressEmitter } from "../progress.js";
import { config } from "../config.js";

export const monitoringWorker = new Worker<MonitoringJobData>(
  "weekly-monitoring",
  async (job) => {
    const { weekLabel, holdingId, ticker } = job.data;

    console.log(
      `[weekly-worker] Starting job ${job.id} — ticker=${ticker} holdingId=${holdingId} week=${weekLabel}`,
    );

    const service = new WeeklyMonitoringService();
    try {
      const startTime = Date.now();
      const logId = await service.monitorHolding(holdingId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(
        `[weekly-worker] SUCCESS ${ticker} — logId=${logId} (${elapsed}s)`,
      );

      // Update batch state in Redis
      await redisConnection.hincrby(`monitoring:batch:${weekLabel}`, "completed", 1);
      const state = await redisConnection.hgetall(`monitoring:batch:${weekLabel}`);

      progressEmitter.emit(`monitoring:${weekLabel}`, {
        type: "holding_complete",
        holdingId,
        ticker,
        logId,
      });

      const total = parseInt(state.total, 10);
      const completed = parseInt(state.completed, 10);
      const failed = parseInt(state.failed, 10);

      console.log(
        `[weekly-worker] Batch progress: ${completed}/${total} complete, ${failed} failed`,
      );

      progressEmitter.emit(`monitoring:${weekLabel}`, {
        type: "progress",
        completed,
        failed,
        total,
        currentTicker: ticker,
      });

      if (completed + failed >= total) {
        console.log(`[weekly-worker] Batch ${weekLabel} finished`);
        await redisConnection.hset(`monitoring:batch:${weekLabel}`, "status", "complete");
        const failures = await redisConnection.lrange(
          `monitoring:batch:${weekLabel}:failures`,
          0,
          -1,
        );
        progressEmitter.emit(`monitoring:${weekLabel}`, {
          type: "batch_complete",
          completed,
          failed,
          total,
          failures: failures.map((f: string) => JSON.parse(f)),
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";
      const errorStack = err instanceof Error ? err.stack : String(err);
      const attemptsMade = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? 3;
      const isLastAttempt = attemptsMade >= maxAttempts;

      console.error(
        `[weekly-worker] FAILED ${ticker} (attempt ${attemptsMade}/${maxAttempts}) — ${errorMessage}`,
      );
      console.error(`[weekly-worker] Stack:`, errorStack);

      if (isLastAttempt) {
        await redisConnection.hincrby(`monitoring:batch:${weekLabel}`, "failed", 1);
        await redisConnection.rpush(
          `monitoring:batch:${weekLabel}:failures`,
          JSON.stringify({ holdingId, ticker, error: errorMessage }),
        );

        const state = await redisConnection.hgetall(`monitoring:batch:${weekLabel}`);
        const total = parseInt(state.total, 10);
        const completed = parseInt(state.completed, 10);
        const failed = parseInt(state.failed, 10);

        console.error(
          `[weekly-worker] Batch progress after final failure: ${completed}/${total} complete, ${failed} failed`,
        );

        progressEmitter.emit(`monitoring:${weekLabel}`, {
          type: "holding_failed",
          holdingId,
          ticker,
          error: errorMessage,
        });

        progressEmitter.emit(`monitoring:${weekLabel}`, {
          type: "progress",
          completed,
          failed,
          total,
          currentTicker: ticker,
        });

        if (completed + failed >= total) {
          console.log(
            `[weekly-worker] Batch ${weekLabel} finished (with ${failed} failures)`,
          );
          await redisConnection.hset(`monitoring:batch:${weekLabel}`, "status", "complete");
          const failures = await redisConnection.lrange(
            `monitoring:batch:${weekLabel}:failures`,
            0,
            -1,
          );
          progressEmitter.emit(`monitoring:${weekLabel}`, {
            type: "batch_complete",
            completed,
            failed,
            total,
            failures: failures.map((f: string) => JSON.parse(f)),
          });
        }
      } else {
        console.log(
          `[weekly-worker] Will retry ${ticker} (attempt ${attemptsMade + 1}/${maxAttempts})`,
        );
      }

      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: config.MONITORING_CONCURRENCY,
  },
);

monitoringWorker.on("error", (err) => {
  console.error("[weekly-worker] Worker-level error:", err);
});

monitoringWorker.on("failed", (job, err) => {
  console.error(
    `[weekly-worker] Job ${job?.id} failed permanently:`,
    err.message,
  );
});

monitoringWorker.on("stalled", (jobId) => {
  console.warn(`[weekly-worker] Job ${jobId} stalled`);
});

console.log("[weekly-worker] Worker registered and listening for jobs");
