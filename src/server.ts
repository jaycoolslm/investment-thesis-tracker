import { config } from "./config.js";
import { createApp } from "./app.js";
import { startScheduler, stopScheduler } from "./jobs/scheduler.js";
import { progressEmitter } from "./progress.js";
import { EmailService } from "./services/email.js";

const app = createApp();

// Subscribe email digest to batch completion events
const emailService = new EmailService();
progressEmitter.on(
  "monitoring:digest",
  async (event: { weekLabel: string; completed: number }) => {
    if (event.completed === 0) return;
    try {
      await emailService.sendWeeklyDigest(event.weekLabel);
    } catch (err) {
      console.error("[email] Failed to send digest:", err);
    }
  },
);

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
