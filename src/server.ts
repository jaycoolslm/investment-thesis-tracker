import { config } from "./config.js";
import { createApp } from "./app.js";
import { startScheduler, stopScheduler } from "./jobs/scheduler.js";

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`API server listening on port ${config.PORT}`);
  startScheduler();
});

// Graceful shutdown
function shutdown() {
  console.log("Shutting down gracefully...");
  stopScheduler();
  server.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
