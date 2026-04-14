import { config } from "./config.js";
import { createApp } from "./app.js";
import { bulkWorker } from "./jobs/bulk-worker.js";
import { bulkQueue } from "./jobs/queue.js";

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`API server listening on port ${config.PORT}`);
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down gracefully...");
  server.close();
  await bulkWorker.close();
  await bulkQueue.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
