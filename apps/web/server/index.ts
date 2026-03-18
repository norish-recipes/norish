import { initCaldavSync } from "@norish/api/caldav/event-listener";
import { serverLogger as log } from "@norish/api/logger";
import { createServer } from "@norish/api/startup/http-server";
import { runStartupMaintenanceCleanup } from "@norish/api/startup/maintenance-cleanup";
import { migrateGalleryImages } from "@norish/api/startup/migrate-gallery-images";
import { runMigrations } from "@norish/api/startup/migrations";
import { seedServerConfig } from "@norish/api/startup/seed-config";
import { registerShutdownHandlers } from "@norish/api/startup/shutdown";
import { initializeVideoProcessing } from "@norish/api/startup/video-processing";
import { initializeServerConfig, SERVER_CONFIG } from "@norish/config/env-config-server";
import { startWorkers } from "@norish/queue/start-workers";

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
