/**
 * BullMQ Workers Startup
 *
 * Every queue's worker starts at boot and runs until shutdown.
 */

import { startAllergyDetectionWorker } from "@norish/queue/allergy-detection/worker";
import { startAutoCategorizationWorker } from "@norish/queue/auto-categorization/worker";
import { startAutoTaggingWorker } from "@norish/queue/auto-tagging/worker";
import { startCaldavSyncWorker } from "@norish/queue/caldav-sync/worker";
import { closeWorkers } from "@norish/queue/create-worker";
import { startImageGenerationWorker } from "@norish/queue/image-generation/worker";
import { startImageImportWorker } from "@norish/queue/image-import/worker";
import { startIngredientFillWorker } from "@norish/queue/ingredient-fill/worker";
import { startIngredientIconsWorker } from "@norish/queue/ingredient-icons/worker";
import { startIngredientLinkingWorker } from "@norish/queue/ingredient-linking/worker";
import { queueAfterMint } from "@norish/queue/ingredient-review/producer";
import { startIngredientReviewWorker } from "@norish/queue/ingredient-review/worker";
import { startNutritionEstimationWorker } from "@norish/queue/nutrition-estimation/worker";
import { startPasteImportWorker } from "@norish/queue/paste-import/worker";
import { startRecipeImportWorker } from "@norish/queue/recipe-import/worker";
import { startRecipeProvenanceWorker } from "@norish/queue/recipe-provenance/worker";
import { closeAllQueues, getQueues, initializeQueues } from "@norish/queue/registry";
import { initializeScheduledJobs } from "@norish/queue/scheduled-tasks/producer";
import { startScheduledTasksWorker } from "@norish/queue/scheduled-tasks/worker";
import { startStoreLookupWorker } from "@norish/queue/store-lookup/worker";
import { closeBullConnection } from "@norish/queue/valkey/bullmq";
import { onIngredientsMinted } from "@norish/shared-server/ingredients/minted";
import { createLogger } from "@norish/shared-server/logger";

const log = createLogger("bullmq");

/**
 * How long a running job gets to finish once shutdown begins, inside the
 * shutdown step's own 30 seconds: then the workers are closed by force.
 */
const WORKER_CLOSE_BUDGET_MS = 20_000;

/**
 * Start every worker at boot. Initializes the queue registry first.
 */
export async function startWorkers(): Promise<void> {
  log.info("Starting all BullMQ workers...");

  await initializeQueues();

  startRecipeImportWorker();
  startImageImportWorker();
  startPasteImportWorker();
  startNutritionEstimationWorker();
  startAutoTaggingWorker();
  startAutoCategorizationWorker();
  startAllergyDetectionWorker();
  startRecipeProvenanceWorker();
  startIngredientLinkingWorker();
  startImageGenerationWorker();
  startIngredientReviewWorker();
  startIngredientIconsWorker();
  startIngredientFillWorker();
  startCaldavSyncWorker();
  startScheduledTasksWorker();
  startStoreLookupWorker();

  // What an administrator lets AI do to a food someone's action mints, in the background.
  onIngredientsMinted(queueAfterMint);

  await initializeScheduledJobs(getQueues().scheduledTasks);

  log.info("All BullMQ workers started");
}

/**
 * Stop all workers gracefully, then the queues and the shared connection.
 */
export async function stopWorkers(): Promise<void> {
  log.info("Stopping all BullMQ workers...");

  await closeWorkers(WORKER_CLOSE_BUDGET_MS);
  await closeAllQueues();

  // Close shared Valkey connection after all workers and queues are stopped
  await closeBullConnection();

  log.info("All BullMQ workers stopped");
}
