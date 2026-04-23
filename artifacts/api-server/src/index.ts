import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachWebSocketServer } from "./ws/consoleServer";
import { startScheduleRunner } from "./cron/scheduleRunner";
import { startNodeHeartbeatWatcher } from "./cron/nodeHeartbeatWatcher";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

attachWebSocketServer(httpServer);

httpServer.listen(port, () => {
  logger.info({ port }, "EGH Panel API listening");
  logger.info("WebSocket console attached at /ws");
  startScheduleRunner();
  startNodeHeartbeatWatcher();
});

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  logger.error({ err }, "HTTP server error");
  process.exit(1);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down gracefully");
  httpServer.close(() => process.exit(0));
});
