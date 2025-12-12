/**
 * BullMQ Workers Startup
 *
 * Initializes all BullMQ workers for background job processing.
 */

import { startRecipeImportWorker, stopRecipeImportWorker } from "@/server/queue/recipe-import/worker";
import { startCaldavSyncWorker, stopCaldavSyncWorker } from "@/server/queue/caldav-sync/worker";

import { createLogger } from "@/server/logger";


const log = createLogger("bullmq");

export function startWorkers(): void {
  startRecipeImportWorker();
  log.info("Recipe import worker started");

  startCaldavSyncWorker();
  log.info("CalDAV sync worker started");
}

export async function stopWorkers(): Promise<void> {
  await stopRecipeImportWorker();
  await stopCaldavSyncWorker();
  log.info("All BullMQ workers stopped");
}
