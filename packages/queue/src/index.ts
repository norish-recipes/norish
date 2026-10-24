/**
 * Queue Module Exports
 *
 * - Registry: every queue, built and closed in one place (initializeQueues, getQueues, closeAllQueues)
 * - Producers: addXxxJob(queue, data) in each producer.ts
 */

// Config
export { baseWorkerOptions } from "./config";
export { QUEUE_NAMES } from "./queue-names";

export { createOperationAwareQueue } from "./operation-aware-queue";

// Registry - centralized lifecycle
export { initializeQueues, getQueues, closeAllQueues } from "./registry";

// Start/Stop workers
export { startWorkers, stopWorkers } from "./start-workers";

// Producers
export { addImportJob } from "./recipe-import/producer";
export { addImageImportJob } from "./image-import/producer";
export { addPasteImportJob } from "./paste-import/producer";
export { MAX_STRUCTURED_PASTE_RECIPES, preparePasteImport } from "./paste-import/parser";
export { addEnrichmentJob } from "./enrichment/producer";
export { enrichRecipe } from "./enrichment/coordinator";
export type { RecipeEnrichmentContext, RecipeEnrichmentRequest } from "./enrichment/coordinator";
export { enrollEnrichmentForAllRecipes } from "./enrichment/bulk";
export type { BulkEnrichmentRequester, BulkEnrichmentResult } from "./enrichment/bulk";
export {
  ENRICHMENT_QUEUE_NAMES,
  enrichmentJobId,
  findActiveEnrichmentJobId,
} from "./enrichment/identity";
export { addCaldavSyncJob } from "./caldav-sync/producer";
export { initializeScheduledJobs } from "./scheduled-tasks/producer";
export { addStoreMatchJob, addStoreRefreshJob } from "./store-lookup/producer";
export { addIngredientReviewJob } from "./ingredient-review/producer";
export { addIngredientIconsJob } from "./ingredient-icons/producer";
export { findRunningIconRound } from "./ingredient-icons/progress";

// Types from @norish/shared/contracts
export type {
  RecipeImportJobData,
  AddImportJobResult,
  ImageImportJobData,
  AddImageImportJobResult,
  PasteImportJobData,
  AddPasteImportJobResult,
  RecipeEnrichmentJobData,
  CaldavSyncJobData,
  CaldavSyncOperation,
  StoreLookupJobData,
} from "@norish/queue/contracts/job-types";

// Types from scheduled-tasks
export type { ScheduledTaskJobData, ScheduledTaskType } from "./scheduled-tasks/tasks";
