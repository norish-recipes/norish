import { runMigrations } from "./server/startup/migrations";
import { seedServerConfig } from "./server/startup/seed-config";
import { initializeVideoProcessing } from "./server/startup/video-processing";
import { startRecurringTasks, runScheduledCleanup } from "./server/startup/start-cron";
import { createServer } from "./server/startup/http-server";
import { initCaldavSync } from "./server/caldav/calendar-sync";
import { startWorkers } from "./server/startup/start-workers";

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

  // Seeds config and loads auth providers into cache
  await seedServerConfig();
  log.info("-".repeat(50));

  await initializeVideoProcessing();
  log.info("-".repeat(50));
  startRecurringTasks();
  log.info("-".repeat(50));
  runScheduledCleanup();
  log.info("-".repeat(50));

  // Initialize CalDAV sync service to listen for calendar events
  initCaldavSync();
  log.info("CalDAV sync service initialized");

  // Start BullMQ workers
  startWorkers();
  const { server, hostname, port } = await createServer();

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
