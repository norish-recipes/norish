/**
 * BullMQ Queue Configuration
 *
 * Centralized configuration for all BullMQ queues and workers.
 * Connection management is handled by @norish/queue/redis/bullmq module.
 */

import type { DefaultJobOptions, Job, Processor, WorkerOptions } from "bullmq";

import type { JobRetentionConfig } from "@norish/config/zod/server-config";

import { createLazyWorker, stopLazyWorker } from "./lazy-worker-manager";
import { getBullClient } from "./redis/bullmq";

/**
 * Queue names for all background job queues
 */
export const QUEUE_NAMES = {
  RECIPE_IMPORT: "recipe-import",
  IMAGE_IMPORT: "image-recipe-import",
  PASTE_IMPORT: "paste-recipe-import",
  CALDAV_SYNC: "caldav-sync",
  SCHEDULED_TASKS: "scheduled-tasks",
  NUTRITION_ESTIMATION: "nutrition-estimation",
  AUTO_TAGGING: "auto-tagging",
  AUTO_CATEGORIZATION: "auto-categorization",
  ALLERGY_DETECTION: "allergy-detection",
  RECIPE_PROVENANCE: "recipe-provenance",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface LazyWorkerController {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Base worker options shared across all workers.
 */
export const baseWorkerOptions: Partial<WorkerOptions> = {
  // Delay between job completions when draining (reduces CPU churn)
  drainDelay: 5_000, // 5 seconds

  // Limit stalled job retries to prevent infinite loops
  maxStalledCount: 1,

  // Lock settings for job processing
  lockDuration: 60_000, // 60 seconds
  lockRenewTime: 15_000, // Renew lock every 15 seconds
};

/**
 * Stalled interval per queue (ms).
 * User-facing imports need quick recovery; background tasks can be slower.
 */
export const STALLED_INTERVAL = {
  [QUEUE_NAMES.RECIPE_IMPORT]: 5_000, // 5s - user waiting
  [QUEUE_NAMES.IMAGE_IMPORT]: 5_000, // 5s - user waiting
  [QUEUE_NAMES.PASTE_IMPORT]: 5_000, // 5s - user waiting
  [QUEUE_NAMES.CALDAV_SYNC]: 120_000, // 2 min - background sync
  [QUEUE_NAMES.SCHEDULED_TASKS]: 3_600_000, // 1 hour - daily cron jobs only
  [QUEUE_NAMES.NUTRITION_ESTIMATION]: 60_000, // 1 min - background enhancement
  [QUEUE_NAMES.AUTO_TAGGING]: 60_000, // 1 min - background enhancement
  [QUEUE_NAMES.AUTO_CATEGORIZATION]: 60_000, // 1 min - background enhancement
  [QUEUE_NAMES.ALLERGY_DETECTION]: 60_000, // 1 min - background enhancement
  [QUEUE_NAMES.RECIPE_PROVENANCE]: 60_000, // 1 min - background enhancement
} as const;

/**
 * Worker concurrency settings per queue.
 */
export const WORKER_CONCURRENCY = {
  [QUEUE_NAMES.RECIPE_IMPORT]: 2,
  [QUEUE_NAMES.IMAGE_IMPORT]: 2,
  [QUEUE_NAMES.PASTE_IMPORT]: 2,
  [QUEUE_NAMES.CALDAV_SYNC]: 1,
  [QUEUE_NAMES.SCHEDULED_TASKS]: 1,
  [QUEUE_NAMES.NUTRITION_ESTIMATION]: 2,
  [QUEUE_NAMES.AUTO_TAGGING]: 2,
  [QUEUE_NAMES.AUTO_CATEGORIZATION]: 2,
  [QUEUE_NAMES.ALLERGY_DETECTION]: 2,
  [QUEUE_NAMES.RECIPE_PROVENANCE]: 2,
} as const;

/**
 * Define the standard lifecycle and configuration for an on-demand worker.
 *
 * Queue-specific modules own only their processor and failure policy. Redis,
 * stalled recovery, concurrency, registration, and shutdown stay consistent.
 */
export function defineLazyWorker<T>(
  queueName: QueueName,
  processor: Processor<T>,
  onFailed?: (job: Job<T> | undefined, error: Error) => void | Promise<void>
): LazyWorkerController {
  return {
    start: () =>
      createLazyWorker(
        queueName,
        processor,
        {
          connection: getBullClient(),
          ...baseWorkerOptions,
          stalledInterval: STALLED_INTERVAL[queueName],
          concurrency: WORKER_CONCURRENCY[queueName],
        },
        onFailed
      ),
    stop: () => stopLazyWorker(queueName),
  };
}

export const RECIPE_IMPORT_PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Active jobs running longer than this are flagged as "hanging" in the
 * admin job monitor. Imports have a 30-min hard timeout, so 10 min already
 * signals something is off before BullMQ gives up.
 */
export const HANGING_THRESHOLD_MS: Record<QueueName, number> = {
  [QUEUE_NAMES.RECIPE_IMPORT]: 10 * 60_000,
  [QUEUE_NAMES.IMAGE_IMPORT]: 10 * 60_000,
  [QUEUE_NAMES.PASTE_IMPORT]: 10 * 60_000,
  [QUEUE_NAMES.CALDAV_SYNC]: 15 * 60_000,
  [QUEUE_NAMES.SCHEDULED_TASKS]: 60 * 60_000,
  [QUEUE_NAMES.NUTRITION_ESTIMATION]: 15 * 60_000,
  [QUEUE_NAMES.AUTO_TAGGING]: 15 * 60_000,
  [QUEUE_NAMES.AUTO_CATEGORIZATION]: 15 * 60_000,
  [QUEUE_NAMES.ALLERGY_DETECTION]: 15 * 60_000,
  [QUEUE_NAMES.RECIPE_PROVENANCE]: 15 * 60_000,
};

export type QueueRemovalOptions = Pick<DefaultJobOptions, "removeOnComplete" | "removeOnFail">;

/**
 * Build removeOnComplete/removeOnFail options from the admin-configured
 * job retention. Applied to all queues at initialization; jobs keep the
 * options they were enqueued with, so changes require a restart and only
 * affect new jobs.
 */
export function buildRemovalOptions(retention: JobRetentionConfig): QueueRemovalOptions {
  const age = retention.maxAgeDays * 86_400;

  return {
    removeOnComplete: { count: retention.keepCompleted, age },
    removeOnFail: { count: retention.keepFailed, age },
  };
}

/** Fallback retention when the config cannot be read: keep 100 jobs / 7 days. */
const FALLBACK_REMOVAL = { count: 100, age: 604_800 } as const;

export const recipeImportJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: FALLBACK_REMOVAL,
  removeOnFail: FALLBACK_REMOVAL,
};

export const imageImportJobOptions: DefaultJobOptions = {
  attempts: 2, // Fewer retries for expensive AI operations
  backoff: {
    type: "exponential",
    delay: 5000, // 5s, 10s
  },
  removeOnComplete: {
    age: 3600,
    count: 500,
  },
  removeOnFail: FALLBACK_REMOVAL,
};

export const pasteImportJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: {
    age: 3600,
    count: 1000,
  },
  removeOnFail: FALLBACK_REMOVAL,
};

export const caldavSyncJobOptions: DefaultJobOptions = {
  attempts: 10,
  backoff: {
    type: "exponential",
    delay: 60000, // 1m, 2m, 4m, 8m... up to 17h
  },
  removeOnComplete: {
    age: 3600,
    count: 2000,
  },
  removeOnFail: {
    age: 86400, // Failed state also persisted to Postgres
    count: 1000,
  },
};

export const scheduledTasksJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000, // 5s, 10s, 20s
  },
  removeOnComplete: {
    age: 86400, // Keep for 24 hours for audit
    count: 100,
  },
  removeOnFail: {
    age: 86400,
    count: 50,
  },
};

export const nutritionEstimationJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    age: 3600,
    count: 500,
  },
  removeOnFail: FALLBACK_REMOVAL,
};

export const autoTaggingJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    age: 3600,
    count: 500,
  },
  removeOnFail: FALLBACK_REMOVAL,
};

export const autoCategorizationJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    age: 3600,
    count: 500,
  },
  removeOnFail: FALLBACK_REMOVAL,
};

export const allergyDetectionJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    age: 3600,
    count: 500,
  },
  removeOnFail: FALLBACK_REMOVAL,
};

export const recipeProvenanceJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    age: 3600,
    count: 500,
  },
  removeOnFail: FALLBACK_REMOVAL,
};
