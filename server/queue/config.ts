/**
 * BullMQ Queue Configuration
 *
 * Centralized configuration for all BullMQ queues and workers.
 * Connection management is handled by @/server/redis/bullmq module.
 */

import type { DefaultJobOptions, WorkerOptions } from "bullmq";

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
  ALLERGY_DETECTION: "allergy-detection",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

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
  [QUEUE_NAMES.ALLERGY_DETECTION]: 60_000, // 1 min - background enhancement
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
  [QUEUE_NAMES.ALLERGY_DETECTION]: 2,
} as const;

/**
 * Job options for recipe import jobs
 */
export const recipeImportJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    age: 3600, // Keep completed jobs for 1 hour
    count: 1000, // But max 1000 jobs
  },
  removeOnFail: true,
};

/**
 * Job options for image import jobs
 */
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
  removeOnFail: true,
};

/**
 * Job options for paste import jobs
 */
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
  removeOnFail: true,
};

/**
 * Job options for CalDAV sync jobs
 */
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

/**
 * Job options for scheduled maintenance tasks
 */
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

/**
 * Job options for nutrition estimation jobs
 */
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
  removeOnFail: true,
};

/**
 * Job options for auto-tagging jobs
 */
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
  removeOnFail: true,
};

/**
 * Job options for allergy detection jobs
 */
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
  removeOnFail: true,
};
