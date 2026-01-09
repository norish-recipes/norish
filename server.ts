import { runMigrations } from "./server/startup/migrations";
import { seedServerConfig } from "./server/startup/seed-config";
import { initializeVideoProcessing } from "./server/startup/video-processing";
import { createServer } from "./server/startup/http-server";
import { initCaldavSync, stopCaldavSync } from "./server/caldav/event-listener";
import { startWorkers, stopWorkers } from "./server/queue/start-workers";
import { closeRedisConnections } from "./server/redis/client";

import { initializeServerConfig, SERVER_CONFIG } from "@/config/env-config-server";
import { serverLogger as log } from "@/server/logger";

async function main() {
  const config = initializeServerConfig();

  log.info("-".repeat(50));
  log.info("Server configuration loaded:");
  log.info(`  Environment: ${config.NODE_ENV}`);
  log.info(`  Database: ${config.DATABASE_URL}`);
  log.info(`  Auth URL: ${config.AUTH_URL}`);
  log.info(`  Upload dir: ${config.UPLOADS_DIR}`);
  log.info("-".repeat(50));

  await runMigrations();
  log.info("-".repeat(50));

  await seedServerConfig();
  log.info("-".repeat(50));

  await initializeVideoProcessing();
  log.info("-".repeat(50));

  initCaldavSync();
  log.info("CalDAV sync service initialized");
  log.info("-".repeat(50));

  await startWorkers();
  log.info("-".repeat(50));

  const { server, hostname, port } = await createServer();

  // Graceful shutdown handler
  let isShuttingDown = false;

  async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log.info(`Received ${signal}, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        log.error({ err }, "Error closing HTTP server");
      } else {
        log.info("HTTP server closed");
      }
    });

    try {
      // Stop CalDAV sync service
      stopCaldavSync();
      log.info("CalDAV sync service stopped");

      // Stop all BullMQ workers and close Redis connections
      await stopWorkers();

      // Close Redis pub/sub connections
      await closeRedisConnections();
      log.info("Redis connections closed");

      log.info("Graceful shutdown completed");
      process.exit(0);
    } catch (err) {
      log.error({ err }, "Error during graceful shutdown");
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  server.listen(port, hostname, () => {
    log.info("-".repeat(50));
    log.info("Server ready:");
    log.info(`  HTTP: http://${hostname}:${port}`);
    log.info(`  WS:   ws://${hostname}:${port}/ws`);
    log.info(`  ENV:  ${SERVER_CONFIG.NODE_ENV}`);
    log.info("-".repeat(50));
  });
}

main().catch((err) => {
  log.fatal({ err }, "Server startup failed");
  process.exit(1);
});
