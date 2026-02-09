/**
 * BullMQ Workers Startup
 *
 * Initializes all BullMQ workers at server boot.
 * Most workers use lazy loading (start on-demand, pause when idle).
 * Only scheduled-tasks runs continuously for cron jobs.
 */

import { startRecipeImportWorker } from "@/server/queue/recipe-import/worker";
import { startImageImportWorker } from "@/server/queue/image-import/worker";
import { startPasteImportWorker } from "@/server/queue/paste-import/worker";
import { startNutritionEstimationWorker } from "@/server/queue/nutrition-estimation/worker";
import { startAutoTaggingWorker } from "@/server/queue/auto-tagging/worker";
import { startAutoCategorizationWorker } from "@/server/queue/auto-categorization/worker";
import { startAllergyDetectionWorker } from "@/server/queue/allergy-detection/worker";
import { startCaldavSyncWorker } from "@/server/queue/caldav-sync/worker";
import {
  startScheduledTasksWorker,
  stopScheduledTasksWorker,
} from "@/server/queue/scheduled-tasks/worker";
import { stopAllLazyWorkers } from "@/server/queue/lazy-worker-manager";
import { initializeQueues, getQueues, closeAllQueues } from "@/server/queue/registry";
import { initializeScheduledJobs } from "@/server/queue/scheduled-tasks/producer";
import { closeBullConnection } from "@/server/redis/bullmq";
import { createLogger } from "@/server/logger";

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
