/**
 * BullMQ Workers Startup
 *
 * Initializes all BullMQ workers for background job processing.
 */

import {
  startRecipeImportWorker,
  stopRecipeImportWorker,
} from "@/server/queue/recipe-import/worker";
import { startCaldavSyncWorker, stopCaldavSyncWorker } from "@/server/queue/caldav-sync/worker";
import {
  startScheduledTasksWorker,
  stopScheduledTasksWorker,
} from "@/server/queue/scheduled-tasks/worker";
import { initializeScheduledJobs } from "@/server/queue/scheduled-tasks/queue";

import { createLogger } from "@/server/logger";

const log = createLogger("bullmq");

export async function startWorkers(): Promise<void> {
  startRecipeImportWorker();
  log.info("Recipe import worker started");

  startCaldavSyncWorker();
  log.info("CalDAV sync worker started");

  startScheduledTasksWorker();
  await initializeScheduledJobs();
  log.info("Scheduled tasks worker started");
}

export async function stopWorkers(): Promise<void> {
  await stopRecipeImportWorker();
  await stopCaldavSyncWorker();
  await stopScheduledTasksWorker();
  log.info("All BullMQ workers stopped");
}
