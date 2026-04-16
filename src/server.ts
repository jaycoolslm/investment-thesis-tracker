import { config } from "./config.js";
import { createApp } from "./app.js";
import { bulkWorker } from "./jobs/bulk-worker.js";
import { monitoringWorker } from "./jobs/weekly-worker.js";
import { bulkQueue, monitoringQueue } from "./jobs/queue.js";
import { startScheduler, stopScheduler } from "./jobs/scheduler.js";

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`API server listening on port ${config.PORT}`);
  startScheduler();
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down gracefully...");
  stopScheduler();
  server.close();
  await bulkWorker.close();
  await monitoringWorker.close();
  await bulkQueue.close();
  await monitoringQueue.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
