/**
 * BullMQ Workers Startup
 *
 * Initializes all BullMQ workers at server boot.
 * Most workers use lazy loading (start on-demand, pause when idle).
 * Only scheduled-tasks runs continuously for cron jobs.
 */

import { startAllergyDetectionWorker } from "@norish/queue/allergy-detection/worker";
import { startAutoCategorizationWorker } from "@norish/queue/auto-categorization/worker";
import { startAutoTaggingWorker } from "@norish/queue/auto-tagging/worker";
import { startCaldavSyncWorker } from "@norish/queue/caldav-sync/worker";
import { startImageImportWorker } from "@norish/queue/image-import/worker";
import { stopAllLazyWorkers } from "@norish/queue/lazy-worker-manager";
import { startNutritionEstimationWorker } from "@norish/queue/nutrition-estimation/worker";
import { startPasteImportWorker } from "@norish/queue/paste-import/worker";
import { startRecipeImportWorker } from "@norish/queue/recipe-import/worker";
import { closeBullConnection } from "@norish/queue/redis/bullmq";
import { closeAllQueues, getQueues, initializeQueues } from "@norish/queue/registry";
import { initializeScheduledJobs } from "@norish/queue/scheduled-tasks/producer";
import {
  startScheduledTasksWorker,
  stopScheduledTasksWorker,
} from "@norish/queue/scheduled-tasks/worker";
import { createLogger } from "@norish/shared-server/logger";

const log = createLogger("bullmq");

/**
 * Start all workers at boot.
 * Initializes queue registry first, then starts workers.
 *
 * Lazy workers (recipe-import, image-import, paste-import, nutrition-estimation,
 * auto-tagging, allergy-detection, caldav-sync) start in paused state and only
 * begin processing when jobs are added. They pause again after 30s of idle time.
 *
 * Scheduled-tasks worker runs continuously for daily cron jobs.
 */
export async function startWorkers(): Promise<void> {
  log.info("Starting all BullMQ workers...");

  // Initialize all queues first
  initializeQueues();

  // Lazy import workers (start on-demand when jobs are added)
  // All lazy workers must be awaited to ensure Redis connections are ready
  // and existing waiting jobs are processed
  await Promise.all([
    startRecipeImportWorker(),
    startImageImportWorker(),
    startPasteImportWorker(),
    startNutritionEstimationWorker(),
    startAutoTaggingWorker(),
    startAutoCategorizationWorker(),
    startAllergyDetectionWorker(),
    startCaldavSyncWorker(),
  ]);

  // Scheduled tasks (always-running for cron jobs)
  startScheduledTasksWorker();
  await initializeScheduledJobs(getQueues().scheduledTasks);

  log.info("All BullMQ workers started (lazy workers waiting for jobs)");
}

/**
 * Stop all workers gracefully.
 */
export async function stopWorkers(): Promise<void> {
  log.info("Stopping all BullMQ workers...");

  // Stop all lazy workers (recipe-import, image-import, paste-import,
  // nutrition-estimation, auto-tagging, allergy-detection, caldav-sync)
  await stopAllLazyWorkers();

  // Stop the always-running scheduled tasks worker
  await stopScheduledTasksWorker();

  // Close all queue connections via registry
  await closeAllQueues();

  // Close shared Redis connection after all workers and queues are stopped
  await closeBullConnection();

  log.info("All BullMQ workers stopped");
}
