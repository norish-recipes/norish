export {
  recipeImportJobOptions,
  caldavSyncJobOptions,
  scheduledTasksJobOptions,
  QUEUE_NAMES,
  baseWorkerOptions,
  WORKER_CONCURRENCY,
  STALLED_INTERVAL,
} from "./config";

export { generateJobId, isJobInQueue } from "./helpers";

export { startWorkers, stopWorkers } from "./start-workers";

export { recipeImportQueue, addImportJob, closeRecipeImportQueue } from "./recipe-import/queue";

export { startRecipeImportWorker, stopRecipeImportWorker } from "./recipe-import/worker";

export { imageImportQueue, addImageImportJob, closeImageImportQueue } from "./image-import/queue";

export { startImageImportWorker, stopImageImportWorker } from "./image-import/worker";

export { pasteImportQueue, addPasteImportJob, closePasteImportQueue } from "./paste-import/queue";

export { startPasteImportWorker, stopPasteImportWorker } from "./paste-import/worker";

export {
  nutritionEstimationQueue,
  addNutritionEstimationJob,
  closeNutritionEstimationQueue,
} from "./nutrition-estimation/queue";

export {
  startNutritionEstimationWorker,
  stopNutritionEstimationWorker,
} from "./nutrition-estimation/worker";

export {
  autoTaggingQueue,
  addAutoTaggingJob,
  closeAutoTaggingQueue,
  isAutoTaggingJobActive,
} from "./auto-tagging/queue";

export { startAutoTaggingWorker, stopAutoTaggingWorker } from "./auto-tagging/worker";

export {
  allergyDetectionQueue,
  addAllergyDetectionJob,
  closeAllergyDetectionQueue,
  isAllergyDetectionJobActive,
} from "./allergy-detection/queue";

export {
  startAllergyDetectionWorker,
  stopAllergyDetectionWorker,
} from "./allergy-detection/worker";

export { caldavSyncQueue, addCaldavSyncJob, closeCaldavSyncQueue } from "./caldav-sync/queue";

export { startCaldavSyncWorker, stopCaldavSyncWorker } from "./caldav-sync/worker";

export {
  scheduledTasksQueue,
  initializeScheduledJobs,
  closeScheduledTasksQueue,
} from "./scheduled-tasks/queue";

export { startScheduledTasksWorker, stopScheduledTasksWorker } from "./scheduled-tasks/worker";

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
  AllergyDetectionJobData,
  AddAllergyDetectionJobResult,
  CaldavSyncJobData,
  CaldavSyncOperation,
} from "@/types";

export type { ScheduledTaskJobData, ScheduledTaskType } from "./scheduled-tasks/queue";
