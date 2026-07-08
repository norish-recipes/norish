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

import type { JobRetentionConfig } from "@norish/config/zod/server-config";
import type {
  AllergyDetectionJobData,
  AutoCategorizationJobData,
  AutoTaggingJobData,
  CaldavSyncJobData,
  ImageImportJobData,
  NutritionEstimationJobData,
  PasteImportJobData,
  RecipeImportJobData,
} from "@norish/queue/contracts/job-types";
import { DEFAULT_JOB_RETENTION, ServerConfigKeys } from "@norish/config/zod/server-config";
import { getConfig } from "@norish/db/repositories/server-config";
import { createLogger } from "@norish/shared-server/logger";

import type { QueueName } from "./config";
import type { ScheduledTaskJobData } from "./scheduled-tasks/queue";
import { createAllergyDetectionQueue } from "./allergy-detection/queue";
import { createAutoCategorizationQueue } from "./auto-categorization/queue";
import { createAutoTaggingQueue } from "./auto-tagging/queue";
import { createCaldavSyncQueue } from "./caldav-sync/queue";
import { buildRemovalOptions, QUEUE_NAMES } from "./config";
import { createImageImportQueue } from "./image-import/queue";
import { createNutritionEstimationQueue } from "./nutrition-estimation/queue";
import { createPasteImportQueue } from "./paste-import/queue";
import { createRecipeImportQueue } from "./recipe-import/queue";
import { createScheduledTasksQueue } from "./scheduled-tasks/queue";

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

let initializing: Promise<QueueRegistry> | null = null;

async function loadJobRetention(): Promise<JobRetentionConfig> {
  try {
    const retention = await getConfig<JobRetentionConfig>(ServerConfigKeys.JOB_RETENTION);

    return retention ?? DEFAULT_JOB_RETENTION;
  } catch (err) {
    log.warn({ err }, "Failed to load job retention config, using defaults");

    return DEFAULT_JOB_RETENTION;
  }
}

/**
 * Initialize all queues. Call once at server startup.
 * Idempotent - safe to call multiple times (returns existing registry).
 *
 * Reads the admin-configured job retention once; changing the retention
 * config requires a server restart to take effect.
 */
export async function initializeQueues(): Promise<QueueRegistry> {
  if (registry) {
    log.debug("Queue registry already initialized");

    return registry;
  }

  if (initializing) {
    return initializing;
  }

  initializing = (async () => {
    log.info("Initializing queue registry...");

    const retention = await loadJobRetention();
    const removalOptions = buildRemovalOptions(retention);

    registry = {
      recipeImport: createRecipeImportQueue(removalOptions),
      imageImport: createImageImportQueue(removalOptions),
      pasteImport: createPasteImportQueue(removalOptions),
      nutritionEstimation: createNutritionEstimationQueue(removalOptions),
      autoTagging: createAutoTaggingQueue(removalOptions),
      autoCategorization: createAutoCategorizationQueue(removalOptions),
      allergyDetection: createAllergyDetectionQueue(removalOptions),
      caldavSync: createCaldavSyncQueue(removalOptions),
      scheduledTasks: createScheduledTasksQueue(removalOptions),
    };

    globalForRegistry.queueRegistry = registry;

    log.info({ retention }, "Queue registry initialized");

    return registry;
  })();

  try {
    return await initializing;
  } finally {
    initializing = null;
  }
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
 * Get a single queue by its BullMQ queue name. Throws if not initialized.
 */
export function getQueueByName(name: QueueName): Queue {
  const byName: Record<QueueName, Queue> = {
    [QUEUE_NAMES.RECIPE_IMPORT]: getQueues().recipeImport,
    [QUEUE_NAMES.IMAGE_IMPORT]: getQueues().imageImport,
    [QUEUE_NAMES.PASTE_IMPORT]: getQueues().pasteImport,
    [QUEUE_NAMES.NUTRITION_ESTIMATION]: getQueues().nutritionEstimation,
    [QUEUE_NAMES.AUTO_TAGGING]: getQueues().autoTagging,
    [QUEUE_NAMES.AUTO_CATEGORIZATION]: getQueues().autoCategorization,
    [QUEUE_NAMES.ALLERGY_DETECTION]: getQueues().allergyDetection,
    [QUEUE_NAMES.CALDAV_SYNC]: getQueues().caldavSync,
    [QUEUE_NAMES.SCHEDULED_TASKS]: getQueues().scheduledTasks,
  };

  return byName[name];
}

/**
 * Get all queues with their BullMQ names. Throws if not initialized.
 */
export function getAllQueueEntries(): { name: QueueName; queue: Queue }[] {
  return (Object.values(QUEUE_NAMES) as QueueName[]).map((name) => ({
    name,
    queue: getQueueByName(name),
  }));
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
