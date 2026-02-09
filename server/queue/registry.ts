/**
 * Queue Registry
 *
 * Centralized lifecycle management for all BullMQ queues.
 * Queues are created once at server startup and closed on shutdown.
 *
 * This module is the single source of truth for queue instances.
 * Consumers should import queues from here, not create their own.
 */

import type { Queue } from "bullmq";
import type { RecipeImportJobData } from "@/types";
import type { ImageImportJobData } from "@/types";
import type { PasteImportJobData } from "@/types";
import type { NutritionEstimationJobData } from "@/types";
import type { AutoTaggingJobData } from "@/types";
import type { AutoCategorizationJobData } from "@/types";
import type { AllergyDetectionJobData } from "@/types";
import type { CaldavSyncJobData } from "@/types";

import { createRecipeImportQueue } from "./recipe-import/queue";
import { createImageImportQueue } from "./image-import/queue";
import { createPasteImportQueue } from "./paste-import/queue";
import { createNutritionEstimationQueue } from "./nutrition-estimation/queue";
import { createAutoTaggingQueue } from "./auto-tagging/queue";
import { createAutoCategorizationQueue } from "./auto-categorization/queue";
import { createAllergyDetectionQueue } from "./allergy-detection/queue";
import { createCaldavSyncQueue } from "./caldav-sync/queue";
import { createScheduledTasksQueue, type ScheduledTaskJobData } from "./scheduled-tasks/queue";

import { createLogger } from "@/server/logger";

const log = createLogger("queue:registry");

/**
 * Registry state - holds all active queue instances.
 * Uses globalThis to survive HMR in development.
 */
const globalForRegistry = globalThis as unknown as {
  queueRegistry: QueueRegistry | null;
};

interface QueueRegistry {
  recipeImport: Queue<RecipeImportJobData>;
  imageImport: Queue<ImageImportJobData>;
  pasteImport: Queue<PasteImportJobData>;
  nutritionEstimation: Queue<NutritionEstimationJobData>;
  autoTagging: Queue<AutoTaggingJobData>;
  autoCategorization: Queue<AutoCategorizationJobData>;
  allergyDetection: Queue<AllergyDetectionJobData>;
  caldavSync: Queue<CaldavSyncJobData>;
  scheduledTasks: Queue<ScheduledTaskJobData>;
}

let registry: QueueRegistry | null = globalForRegistry.queueRegistry ?? null;

/**
 * Initialize all queues. Call once at server startup.
 * Idempotent - safe to call multiple times (returns existing registry).
 */
export function initializeQueues(): QueueRegistry {
  if (registry) {
    log.debug("Queue registry already initialized");

    return registry;
  }

  log.info("Initializing queue registry...");

  registry = {
    recipeImport: createRecipeImportQueue(),
    imageImport: createImageImportQueue(),
    pasteImport: createPasteImportQueue(),
    nutritionEstimation: createNutritionEstimationQueue(),
    autoTagging: createAutoTaggingQueue(),
    autoCategorization: createAutoCategorizationQueue(),
    allergyDetection: createAllergyDetectionQueue(),
    caldavSync: createCaldavSyncQueue(),
    scheduledTasks: createScheduledTasksQueue(),
  };

  globalForRegistry.queueRegistry = registry;

  log.info("Queue registry initialized");

  return registry;
}

/**
 * Get the queue registry. Throws if not initialized.
 * Use this in application code that needs queue access.
 */
export function getQueues(): QueueRegistry {
  if (!registry) {
    throw new Error("Queue registry not initialized. Call initializeQueues() at server startup.");
  }

  return registry;
}

/**
 * Close all queues. Call during server shutdown.
 */
export async function closeAllQueues(): Promise<void> {
  if (!registry) {
    log.debug("No queue registry to close");

    return;
  }

  log.info("Closing all queues...");

  await Promise.all([
    registry.recipeImport.close(),
    registry.imageImport.close(),
    registry.pasteImport.close(),
    registry.nutritionEstimation.close(),
    registry.autoTagging.close(),
    registry.autoCategorization.close(),
    registry.allergyDetection.close(),
    registry.caldavSync.close(),
    registry.scheduledTasks.close(),
  ]);

  registry = null;
  globalForRegistry.queueRegistry = null;

  log.info("All queues closed");
}
