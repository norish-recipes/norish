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
import { initializeQueues, getQueues, closeAllQueues } from "@/server/queue/registry";
import { initializeScheduledJobs } from "@/server/queue/scheduled-tasks/producer";
import { closeBullConnection } from "@/server/redis/bullmq";
import { createLogger } from "@/server/logger";

const log = createLogger("bullmq");

/**
 * Start all workers at boot.
 * Initializes queue registry first, then starts workers.
 */
export async function startWorkers(): Promise<void> {
  log.info("Starting all BullMQ workers...");

  // Initialize all queues first
  initializeQueues();

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
  await initializeScheduledJobs(getQueues().scheduledTasks);

  log.info("All BullMQ workers started");
}

/**
 * Stop all workers gracefully.
 */
export async function stopWorkers(): Promise<void> {
  log.info("Stopping all BullMQ workers...");

  // Stop all workers first
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

  // Close all queue connections via registry
  await closeAllQueues();

  // Close shared Redis connection after all workers and queues are stopped
  await closeBullConnection();

  log.info("All BullMQ workers stopped");
}
