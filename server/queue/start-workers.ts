/**
 * BullMQ Workers Startup
 *
 * Initializes all BullMQ workers at server boot.
 * Workers share a Redis connection via the centralized bullmq module.
 */

import {
  startRecipeImportWorker,
  stopRecipeImportWorker,
} from "@/server/queue/recipe-import/worker";
import { startImageImportWorker, stopImageImportWorker } from "@/server/queue/image-import/worker";
import { startPasteImportWorker, stopPasteImportWorker } from "@/server/queue/paste-import/worker";
import {
  startNutritionEstimationWorker,
  stopNutritionEstimationWorker,
} from "@/server/queue/nutrition-estimation/worker";
import { startAutoTaggingWorker, stopAutoTaggingWorker } from "@/server/queue/auto-tagging/worker";
import {
  startAllergyDetectionWorker,
  stopAllergyDetectionWorker,
} from "@/server/queue/allergy-detection/worker";
import { startCaldavSyncWorker, stopCaldavSyncWorker } from "@/server/queue/caldav-sync/worker";
import {
  startScheduledTasksWorker,
  stopScheduledTasksWorker,
} from "@/server/queue/scheduled-tasks/worker";
import { initializeScheduledJobs } from "@/server/queue/scheduled-tasks/queue";
import { closeBullConnection } from "@/server/redis/bullmq";
import { createLogger } from "@/server/logger";

const log = createLogger("bullmq");

/**
 * Start all workers at boot.
 */
export async function startWorkers(): Promise<void> {
  log.info("Starting all BullMQ workers...");

  // Import workers
  startRecipeImportWorker();
  startImageImportWorker();
  startPasteImportWorker();

  // Background processing workers
  startNutritionEstimationWorker();
  startAutoTaggingWorker();
  startAllergyDetectionWorker();
  startCaldavSyncWorker();

  // Scheduled tasks
  startScheduledTasksWorker();
  await initializeScheduledJobs();

  log.info("All BullMQ workers started");
}

/**
 * Stop all workers gracefully.
 */
export async function stopWorkers(): Promise<void> {
  log.info("Stopping all BullMQ workers...");

  await Promise.all([
    stopRecipeImportWorker(),
    stopImageImportWorker(),
    stopPasteImportWorker(),
    stopNutritionEstimationWorker(),
    stopAutoTaggingWorker(),
    stopAllergyDetectionWorker(),
    stopCaldavSyncWorker(),
    stopScheduledTasksWorker(),
  ]);

  // Close shared Redis connection after all workers are stopped
  await closeBullConnection();

  log.info("All BullMQ workers stopped");
}
