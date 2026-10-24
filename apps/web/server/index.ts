import { initCaldavSync } from "@norish/api/caldav/event-listener";
import { initRecipeEnrichmentListener } from "@norish/api/recipes/enrichment-listener";
import { applyNutritionSourcesOnBoot } from "@norish/api/startup/apply-nutrition-sources";
import { cleanUpCatalogueOnBoot } from "@norish/api/startup/clean-up-catalogue";
import { correctSeedOnBoot } from "@norish/api/startup/correct-seed";
import { createServer } from "@norish/api/startup/http-server";
import { runStartupMaintenanceCleanup } from "@norish/api/startup/maintenance-cleanup";
import { runMigrations } from "@norish/api/startup/migrations";
import { recheckUndecidedMintsOnBoot } from "@norish/api/startup/recheck-undecided-mints";
import { registerApiHandlersForQueue } from "@norish/api/startup/register-queue-api-handlers";
import { seedServerConfig } from "@norish/api/startup/seed-config";
import { seedIngredientCatalogueOnFirstBoot } from "@norish/api/startup/seed-ingredient-catalogue";
import { seedJunkPileOnBoot } from "@norish/api/startup/seed-junk-pile";
import { registerShutdownHandlers } from "@norish/api/startup/shutdown";
import { initializeVideoProcessing } from "@norish/api/startup/video-processing";
import { initializeServerConfig, SERVER_CONFIG } from "@norish/config/env-config-server";
import { initializeQueues } from "@norish/queue/registry";
import { startWorkers } from "@norish/queue/start-workers";
import { serverLogger as log, redactUrl } from "@norish/shared-server/logger";
import { startRealtimeHub } from "@norish/shared-server/realtime/hub";

import { startEmbeddedParser } from "./embedded-parser";

async function main() {
  const config = initializeServerConfig();
  const embeddedParser = await startEmbeddedParser(config);

  log.info("-".repeat(50));
  log.info("Server configuration loaded:");
  log.info(`  Environment: ${config.NODE_ENV}`);
  log.info(`  Database: ${redactUrl(config.DATABASE_URL)}`);
  log.info(`  Auth URL: ${config.AUTH_URL}`);
  log.info(`  Upload dir: ${config.UPLOADS_DIR}`);
  log.info("-".repeat(50));

  await runMigrations();
  log.info("-".repeat(50));

  await seedServerConfig();
  log.info("-".repeat(50));

  // A first boot seeds the catalogue before traffic; later boots leave it to
  // the refresh job, so an unchanged file never holds the server up.
  await seedIngredientCatalogueOnFirstBoot();
  // Spellings the seed now gives another food move once, with the foods their words filed there.
  await correctSeedOnBoot();
  log.info("-".repeat(50));

  // Old flagged mints, looked at again whenever the resolver's rules change.
  await recheckUndecidedMintsOnBoot();
  log.info("-".repeat(50));

  // What earlier versions left in the catalogue, cleaned once per release that changes the cleanup.
  await cleanUpCatalogueOnBoot();
  // Texts that name no food, which new lines are read without; after the cleanup, which reads
  // spellings as earlier releases left them.
  await seedJunkPileOnBoot();
  log.info("-".repeat(50));

  // Ingredient Nutrition's source numbers, when this release carries new ones.
  await applyNutritionSourcesOnBoot();
  log.info("-".repeat(50));

  await initializeVideoProcessing();
  log.info("-".repeat(50));

  await runStartupMaintenanceCleanup();
  log.info("-".repeat(50));

  registerApiHandlersForQueue();

  // The one Valkey subscriber connection of this process; every internal
  // listener and tRPC subscription registers on it.
  await startRealtimeHub();
  log.info("-".repeat(50));

  initCaldavSync();
  log.info("CalDAV sync service initialized");
  log.info("-".repeat(50));

  // Queues first: the listener enrolls enrichment the moment it receives an
  // event, so subscribing before the registry exists gives it a window in which
  // every kind fails to queue. `startWorkers` initializes them too, and
  // initialization is idempotent, so this only moves the step earlier.
  await initializeQueues();
  log.info("-".repeat(50));

  // Subscribe before any recipe-producing worker or HTTP handler can publish,
  // and await it, so the server never starts creating recipes while claiming a
  // listener it does not have.
  await initRecipeEnrichmentListener();
  log.info("-".repeat(50));

  await startWorkers();
  log.info("-".repeat(50));

  const { server, hostname, port } = await createServer();

  registerShutdownHandlers(
    server,
    embeddedParser ? [{ name: "Stop embedded parser", run: embeddedParser.stop }] : []
  );

  server.listen(port, hostname, () => {
    log.info("-".repeat(50));
    log.info("Server ready:");
    log.info(`  HTTP: http://${hostname}:${port}`);
    log.info(`  WS:   ws://${hostname}:${port}/trpc`);
    log.info(`  ENV:  ${SERVER_CONFIG.NODE_ENV}`);
    log.info("-".repeat(50));
  });
}

main().catch((err) => {
  log.fatal({ err }, "Server startup failed");
  process.exit(1);
});
