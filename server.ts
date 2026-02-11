import { runMigrations } from "./server/startup/migrations";
import { seedServerConfig } from "./server/startup/seed-config";
import { migrateGalleryImages } from "./server/startup/migrate-gallery-images";
import { initializeVideoProcessing } from "./server/startup/video-processing";
import { runStartupMaintenanceCleanup } from "./server/startup/maintenance-cleanup";
import { createServer } from "./server/startup/http-server";
import { registerShutdownHandlers } from "./server/startup/shutdown";
import { initCaldavSync } from "./server/caldav/event-listener";
import { startWorkers } from "./server/queue/start-workers";

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

  await migrateGalleryImages();
  log.info("-".repeat(50));

  await initializeVideoProcessing();
  log.info("-".repeat(50));

  await runStartupMaintenanceCleanup();
  log.info("-".repeat(50));

  initCaldavSync();
  log.info("CalDAV sync service initialized");
  log.info("-".repeat(50));

  await startWorkers();
  log.info("-".repeat(50));

  const { server, hostname, port } = await createServer();

  registerShutdownHandlers(server);

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
