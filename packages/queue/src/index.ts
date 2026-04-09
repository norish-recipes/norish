/**
 * Queue Module Exports
 *
 * New architecture:
 * - Registry: Central lifecycle management (initializeQueues, getQueues, closeAllQueues)
 * - Queue factories: createXxxQueue() in each queue.ts
 * - Producers: addXxxJob(queue, data) in each producer.ts
 */

// Config
export {
  recipeImportJobOptions,
  caldavSyncJobOptions,
  scheduledTasksJobOptions,
  QUEUE_NAMES,
  baseWorkerOptions,
  WORKER_CONCURRENCY,
  STALLED_INTERVAL,
} from "./config";

// Helpers
export { generateJobId, isJobInQueue } from "./helpers";
export { createOperationAwareQueue } from "./operation-aware-queue";

// Registry - centralized lifecycle
export { initializeQueues, getQueues, closeAllQueues } from "./registry";

// Start/Stop workers
export { startWorkers, stopWorkers } from "./start-workers";

// Queue factories
export { createRecipeImportQueue } from "./recipe-import/queue";
export { createImageImportQueue } from "./image-import/queue";
export { createPasteImportQueue } from "./paste-import/queue";
export { createNutritionEstimationQueue } from "./nutrition-estimation/queue";
export { createAutoTaggingQueue } from "./auto-tagging/queue";
export { createAutoCategorizationQueue } from "./auto-categorization/queue";
export { createAllergyDetectionQueue } from "./allergy-detection/queue";
export { createCaldavSyncQueue } from "./caldav-sync/queue";
export { createScheduledTasksQueue } from "./scheduled-tasks/queue";

// Producers
export { addImportJob } from "./recipe-import/producer";
export { addImageImportJob } from "./image-import/producer";
export { addPasteImportJob } from "./paste-import/producer";
export { MAX_STRUCTURED_PASTE_RECIPES, preparePasteImport } from "./paste-import/parser";
export { addNutritionEstimationJob } from "./nutrition-estimation/producer";
export { addAutoTaggingJob, isAutoTaggingJobActive } from "./auto-tagging/producer";
export {
  addAutoCategorizationJob,
  isAutoCategorizationJobActive,
} from "./auto-categorization/producer";
export { addAllergyDetectionJob, isAllergyDetectionJobActive } from "./allergy-detection/producer";
export { addCaldavSyncJob } from "./caldav-sync/producer";
export { initializeScheduledJobs } from "./scheduled-tasks/producer";

// Workers
export { startRecipeImportWorker, stopRecipeImportWorker } from "./recipe-import/worker";
export { startImageImportWorker, stopImageImportWorker } from "./image-import/worker";
export { startPasteImportWorker, stopPasteImportWorker } from "./paste-import/worker";
export {
  startNutritionEstimationWorker,
  stopNutritionEstimationWorker,
} from "./nutrition-estimation/worker";
export { startAutoTaggingWorker, stopAutoTaggingWorker } from "./auto-tagging/worker";
export {
  startAutoCategorizationWorker,
  stopAutoCategorizationWorker,
} from "./auto-categorization/worker";
export {
  startAllergyDetectionWorker,
  stopAllergyDetectionWorker,
} from "./allergy-detection/worker";
export { startCaldavSyncWorker, stopCaldavSyncWorker } from "./caldav-sync/worker";
export { startScheduledTasksWorker, stopScheduledTasksWorker } from "./scheduled-tasks/worker";

// Types from @norish/shared/contracts
export type {
  RecipeImportJobData,
  AddImportJobResult,
  ImageImportJobData,
  AddImageImportJobResult,
  PasteImportJobData,
  AddPasteImportJobResult,
  NutritionEstimationJobData,
  AddNutritionEstimationJobResult,
  AutoTaggingJobData,
  AddAutoTaggingJobResult,
  AutoCategorizationJobData,
  AddAutoCategorizationJobResult,
  AllergyDetectionJobData,
  AddAllergyDetectionJobResult,
  CaldavSyncJobData,
  CaldavSyncOperation,
} from "@norish/queue/contracts/job-types";

// Types from scheduled-tasks
export type { ScheduledTaskJobData, ScheduledTaskType } from "./scheduled-tasks/queue";
