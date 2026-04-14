import { Worker } from "bullmq";
import { redisConnection, type BulkJobData } from "./queue.js";
import { ThesisGenerationService } from "../services/thesis-generation.js";
import { progressEmitter } from "../progress.js";

export const bulkWorker = new Worker<BulkJobData>(
  "bulk-generation",
  async (job) => {
    const { batchId, holdingId, ticker, bullets } = job.data;

    console.log(
      `[bulk-worker] Starting job ${job.id} — ticker=${ticker} holdingId=${holdingId} batchId=${batchId}`,
    );
    console.log(
      `[bulk-worker] Bullets preview: "${bullets.slice(0, 80)}${bullets.length > 80 ? "..." : ""}"`,
    );

    const service = new ThesisGenerationService();
    try {
      const startTime = Date.now();
      const thesisId = await service.generate(holdingId, bullets);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(
        `[bulk-worker] SUCCESS ${ticker} — thesisId=${thesisId} (${elapsed}s)`,
      );

      // Update batch state in Redis
      await redisConnection.hincrby(`batch:${batchId}`, "completed", 1);
      const state = await redisConnection.hgetall(`batch:${batchId}`);

      progressEmitter.emit(batchId, {
        type: "holding_complete",
        holdingId,
        ticker,
        thesisId,
      });

      // Check if batch is done
      const total = parseInt(state.total, 10);
      const completed = parseInt(state.completed, 10);
      const failed = parseInt(state.failed, 10);

      console.log(
        `[bulk-worker] Batch progress: ${completed}/${total} complete, ${failed} failed`,
      );

      progressEmitter.emit(batchId, {
        type: "progress",
        completed,
        failed,
        total,
        currentTicker: ticker,
      });

      if (completed + failed >= total) {
        console.log(`[bulk-worker] Batch ${batchId} finished`);
        await redisConnection.hset(`batch:${batchId}`, "status", "complete");
        const failures = await redisConnection.lrange(
          `batch:${batchId}:failures`,
          0,
          -1,
        );
        progressEmitter.emit(batchId, {
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
      const attemptsMade = job.attemptsMade + 1; // +1 because this attempt hasn't been counted yet
      const maxAttempts = job.opts.attempts ?? 2;
      const isLastAttempt = attemptsMade >= maxAttempts;

      console.error(
        `[bulk-worker] FAILED ${ticker} (attempt ${attemptsMade}/${maxAttempts}) — ${errorMessage}`,
      );
      console.error(`[bulk-worker] Stack:`, errorStack);

      if (isLastAttempt) {
        // Only record the failure in batch state on the final attempt
        await redisConnection.hincrby(`batch:${batchId}`, "failed", 1);
        await redisConnection.rpush(
          `batch:${batchId}:failures`,
          JSON.stringify({ holdingId, ticker, error: errorMessage }),
        );

        const state = await redisConnection.hgetall(`batch:${batchId}`);
        const total = parseInt(state.total, 10);
        const completed = parseInt(state.completed, 10);
        const failed = parseInt(state.failed, 10);

        console.error(
          `[bulk-worker] Batch progress after final failure: ${completed}/${total} complete, ${failed} failed`,
        );

        progressEmitter.emit(batchId, {
          type: "holding_failed",
          holdingId,
          ticker,
          error: errorMessage,
        });

        progressEmitter.emit(batchId, {
          type: "progress",
          completed,
          failed,
          total,
          currentTicker: ticker,
        });

        if (completed + failed >= total) {
          console.log(
            `[bulk-worker] Batch ${batchId} finished (with ${failed} failures)`,
          );
          await redisConnection.hset(`batch:${batchId}`, "status", "complete");
          const failures = await redisConnection.lrange(
            `batch:${batchId}:failures`,
            0,
            -1,
          );
          progressEmitter.emit(batchId, {
            type: "batch_complete",
            completed,
            failed,
            total,
            failures: failures.map((f: string) => JSON.parse(f)),
          });
        }
      } else {
        console.log(
          `[bulk-worker] Will retry ${ticker} (attempt ${attemptsMade + 1}/${maxAttempts})`,
        );
      }

      // Rethrow so BullMQ retries on non-final attempts
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  },
);

bulkWorker.on("error", (err) => {
  console.error("[bulk-worker] Worker-level error:", err);
});

bulkWorker.on("failed", (job, err) => {
  console.error(
    `[bulk-worker] Job ${job?.id} failed permanently:`,
    err.message,
  );
});

bulkWorker.on("stalled", (jobId) => {
  console.warn(`[bulk-worker] Job ${jobId} stalled`);
});

console.log("[bulk-worker] Worker registered and listening for jobs");
