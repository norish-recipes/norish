/**
 * Queue Registry
 *
 * Centralized lifecycle management for all BullMQ queues.
 * Queues are created once at server startup and closed on shutdown.
 *
 * This module is the single source of truth for queue instances.
 * Consumers should import queues from here, not create their own.
 */

import type { Queue, QueueOptions } from "bullmq";
import { Queue as BullQueue } from "bullmq";

import type { JobRetentionConfig } from "@norish/config/zod/server-config";
import type {
  CaldavSyncJobData,
  ImageImportJobData,
  IngredientFillJobData,
  IngredientIconsJobData,
  IngredientReviewJobData,
  PasteImportJobData,
  RecipeEnrichmentJobData,
  RecipeImportJobData,
  StoreLookupJobData,
} from "@norish/queue/contracts/job-types";
import { DEFAULT_JOB_RETENTION, ServerConfigKeys } from "@norish/config/zod/server-config";
import { getConfig } from "@norish/db/repositories/server-config";
import { createLogger } from "@norish/shared-server/logger";

import type { QueueName } from "./queue-names";
import type { ScheduledTaskJobData } from "./scheduled-tasks/tasks";
import { buildRemovalOptions, QUEUE_SETTINGS } from "./config";
import { createOperationAwareQueue, logQueueErrors } from "./operation-aware-queue";
import { QUEUE_NAMES } from "./queue-names";
import { getBullClient } from "./valkey/bullmq";

const log = createLogger("queue:registry");

/**
 * Registry state - holds all active queue instances.
 *
 * Lives on globalThis and is read on every access rather than copied into a
 * module-local, because this module is genuinely evaluated more than once per
 * process. Development resolves `@norish/queue/registry` through the app's path
 * alias into the source tree from one import chain and through the node_modules
 * copy from another; HMR does the same over time. A module-local captured at
 * load time stays null in whichever instance loaded before initialization, and
 * that instance then reports "not initialized" while the queues are running.
 */
const globalForRegistry = globalThis as unknown as {
  queueRegistry: QueueRegistry | null;
  queueRegistryInitializing: Promise<QueueRegistry> | null;
};

interface QueueRegistry {
  recipeImport: Queue<RecipeImportJobData>;
  imageImport: Queue<ImageImportJobData>;
  pasteImport: Queue<PasteImportJobData>;
  nutritionEstimation: Queue<RecipeEnrichmentJobData>;
  autoTagging: Queue<RecipeEnrichmentJobData>;
  autoCategorization: Queue<RecipeEnrichmentJobData>;
  allergyDetection: Queue<RecipeEnrichmentJobData>;
  recipeProvenance: Queue<RecipeEnrichmentJobData>;
  ingredientLinking: Queue<RecipeEnrichmentJobData>;
  imageGeneration: Queue<RecipeEnrichmentJobData>;
  caldavSync: Queue<CaldavSyncJobData>;
  scheduledTasks: Queue<ScheduledTaskJobData>;
  storeLookup: Queue<StoreLookupJobData>;
  ingredientReview: Queue<IngredientReviewJobData>;
  ingredientIcons: Queue<IngredientIconsJobData>;
  ingredientFill: Queue<IngredientFillJobData>;
}

/**
 * The BullMQ name behind each queue's key. A queue is added here, in the
 * registry above, and in `QUEUE_SETTINGS`; the registry builds, finds and
 * closes it from there.
 */
const QUEUE_KEYS: Record<keyof QueueRegistry, QueueName> = {
  recipeImport: QUEUE_NAMES.RECIPE_IMPORT,
  imageImport: QUEUE_NAMES.IMAGE_IMPORT,
  pasteImport: QUEUE_NAMES.PASTE_IMPORT,
  nutritionEstimation: QUEUE_NAMES.NUTRITION_ESTIMATION,
  autoTagging: QUEUE_NAMES.AUTO_TAGGING,
  autoCategorization: QUEUE_NAMES.AUTO_CATEGORIZATION,
  allergyDetection: QUEUE_NAMES.ALLERGY_DETECTION,
  recipeProvenance: QUEUE_NAMES.RECIPE_PROVENANCE,
  ingredientLinking: QUEUE_NAMES.INGREDIENT_LINKING,
  imageGeneration: QUEUE_NAMES.IMAGE_GENERATION,
  caldavSync: QUEUE_NAMES.CALDAV_SYNC,
  scheduledTasks: QUEUE_NAMES.SCHEDULED_TASKS,
  storeLookup: QUEUE_NAMES.STORE_LOOKUP,
  ingredientReview: QUEUE_NAMES.INGREDIENT_REVIEW,
  ingredientIcons: QUEUE_NAMES.INGREDIENT_ICONS,
  ingredientFill: QUEUE_NAMES.INGREDIENT_FILL,
};

/**
 * How many entries a queue's events stream keeps. Every progress write copies
 * the job's whole step timeline into it, BullMQ keeps 10,000 by default, and
 * nothing reads its history: the job monitor reads job state.
 */
export const EVENTS_MAX_LEN = 1_000;

/**
 * A queue as every queue is built: the shared connection, the queue's job
 * defaults under the administrator's retention, and the capped events stream.
 * A Queue built with other options would rewrite the cap in the queue's
 * metadata, which is why no module builds one but this.
 */
function buildQueue(name: QueueName, retention: JobRetentionConfig): Queue {
  const { jobOptions, withoutOperationContext } = QUEUE_SETTINGS[name];
  const options: QueueOptions = {
    connection: getBullClient(),
    defaultJobOptions: { ...jobOptions, ...buildRemovalOptions(retention) },
    streams: { events: { maxLen: EVENTS_MAX_LEN } },
  };

  return withoutOperationContext
    ? logQueueErrors(new BullQueue(name, options))
    : createOperationAwareQueue(name, options);
}

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
  const existing = globalForRegistry.queueRegistry;

  if (existing) {
    log.debug("Queue registry already initialized");

    return existing;
  }

  // The in-flight promise is global too, so a second module instance joins the
  // first one's initialization instead of building a rival set of queues.
  const inFlight = globalForRegistry.queueRegistryInitializing;

  if (inFlight) {
    return inFlight;
  }

  const initializing = (async () => {
    log.info("Initializing queue registry...");

    const retention = await loadJobRetention();
    const created: QueueRegistry = Object.fromEntries(
      Object.entries(QUEUE_KEYS).map(([key, name]) => [key, buildQueue(name, retention)])
    ) as Record<keyof QueueRegistry, Queue>;

    globalForRegistry.queueRegistry = created;

    log.info({ retention }, "Queue registry initialized");

    return created;
  })();

  globalForRegistry.queueRegistryInitializing = initializing;

  try {
    return await initializing;
  } finally {
    globalForRegistry.queueRegistryInitializing = null;
  }
}

/**
 * Get the queue registry. Throws if not initialized.
 * Use this in application code that needs queue access.
 */
export function getQueues(): QueueRegistry {
  const registry = globalForRegistry.queueRegistry;

  if (!registry) {
    throw new Error("Queue registry not initialized. Call initializeQueues() at server startup.");
  }

  return registry;
}

/**
 * Get a single queue by its BullMQ queue name. Throws if not initialized.
 */
export function getQueueByName(name: QueueName): Queue {
  const queue = Object.values(getQueues()).find((candidate: Queue) => candidate.name === name);

  if (!queue) throw new Error(`No queue is named ${name}`);

  return queue;
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
  const registry = globalForRegistry.queueRegistry;

  if (!registry) {
    log.debug("No queue registry to close");

    return;
  }

  log.info("Closing all queues...");

  await Promise.all(Object.values(registry).map((queue: Queue) => queue.close()));

  globalForRegistry.queueRegistry = null;

  log.info("All queues closed");
}
