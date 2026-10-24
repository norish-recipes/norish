/**
 * BullMQ Queue Configuration
 *
 * Centralized configuration for all BullMQ queues and workers.
 * Connection management is handled by @norish/queue/valkey/bullmq module.
 */

import type { DefaultJobOptions, WorkerOptions } from "bullmq";

import type { JobRetentionConfig } from "@norish/config/zod/server-config";

import type { QueueName } from "./queue-names";
import { QUEUE_NAMES } from "./queue-names";

/**
 * Base worker options shared across all workers.
 */
export const baseWorkerOptions: Partial<WorkerOptions> = {
  // Seconds, not milliseconds: how long an idle worker blocks on Valkey per wait.
  drainDelay: 5,

  // Limit stalled job retries to prevent infinite loops
  maxStalledCount: 1,

  // Lock settings for job processing
  lockDuration: 60_000, // 60 seconds
  lockRenewTime: 15_000, // Renew lock every 15 seconds
};

export const RECIPE_IMPORT_PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;

export type QueueRemovalOptions = Pick<DefaultJobOptions, "removeOnComplete" | "removeOnFail">;

/**
 * Build removeOnComplete/removeOnFail options from the admin-configured
 * job retention, the only retention any queue has. Applied to all queues at initialization; jobs
 * keep the options they were enqueued with, so changes require a restart and
 * only affect new jobs.
 */
export function buildRemovalOptions(retention: JobRetentionConfig): QueueRemovalOptions {
  const age = retention.maxAgeDays * 86_400;

  return {
    removeOnComplete: { count: retention.keepCompleted, age },
    removeOnFail: { count: retention.keepFailed, age },
  };
}

/** Three tries, two seconds apart and doubling: 2s, 4s. */
const RETRIED_TWICE: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
};

/** What a queue runs with. */
export interface QueueSettings {
  /** Its jobs' defaults; the administrator's retention is added when the queue is built. */
  jobOptions: DefaultJobOptions;
  /** How many of its jobs a worker runs at once. */
  concurrency: number;
  /** How often (ms) its worker looks for a stalled job. */
  stalledInterval: number;
  /** How long (ms) a job runs before the job monitor flags it as hanging. */
  hangingThresholdMs: number;
  /** Its jobs do not carry the operation context they were enqueued under. */
  withoutOperationContext?: true;
}

/**
 * Every queue's settings. User-facing imports recover stalled jobs quickly;
 * background work can wait. Imports are flagged as hanging at 10 min, well
 * before their 30-min hard timeout.
 */
export const QUEUE_SETTINGS: Record<QueueName, QueueSettings> = {
  [QUEUE_NAMES.RECIPE_IMPORT]: {
    jobOptions: RETRIED_TWICE,
    concurrency: 2,
    stalledInterval: 5_000,
    hangingThresholdMs: 10 * 60_000,
  },
  [QUEUE_NAMES.IMAGE_IMPORT]: {
    // Fewer retries for expensive AI operations: 5s, 10s.
    jobOptions: { attempts: 2, backoff: { type: "exponential", delay: 5000 } },
    concurrency: 2,
    stalledInterval: 5_000,
    hangingThresholdMs: 10 * 60_000,
  },
  [QUEUE_NAMES.PASTE_IMPORT]: {
    jobOptions: RETRIED_TWICE,
    concurrency: 2,
    stalledInterval: 5_000,
    hangingThresholdMs: 10 * 60_000,
  },
  [QUEUE_NAMES.CALDAV_SYNC]: {
    // 1m, 2m, 4m, 8m... up to 17h
    jobOptions: { attempts: 10, backoff: { type: "exponential", delay: 60000 } },
    concurrency: 1,
    stalledInterval: 120_000,
    hangingThresholdMs: 15 * 60_000,
  },
  [QUEUE_NAMES.SCHEDULED_TASKS]: {
    // 5s, 10s, 20s
    jobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    concurrency: 1,
    // Daily cron jobs only.
    stalledInterval: 3_600_000,
    hangingThresholdMs: 60 * 60_000,
    withoutOperationContext: true,
  },
  [QUEUE_NAMES.NUTRITION_ESTIMATION]: {
    jobOptions: RETRIED_TWICE,
    concurrency: 2,
    stalledInterval: 60_000,
    hangingThresholdMs: 15 * 60_000,
  },
  [QUEUE_NAMES.AUTO_TAGGING]: {
    jobOptions: RETRIED_TWICE,
    concurrency: 2,
    stalledInterval: 60_000,
    hangingThresholdMs: 15 * 60_000,
  },
  [QUEUE_NAMES.AUTO_CATEGORIZATION]: {
    jobOptions: RETRIED_TWICE,
    concurrency: 2,
    stalledInterval: 60_000,
    hangingThresholdMs: 15 * 60_000,
  },
  [QUEUE_NAMES.ALLERGY_DETECTION]: {
    jobOptions: RETRIED_TWICE,
    concurrency: 2,
    stalledInterval: 60_000,
    hangingThresholdMs: 15 * 60_000,
  },
  [QUEUE_NAMES.RECIPE_PROVENANCE]: {
    jobOptions: RETRIED_TWICE,
    concurrency: 2,
    stalledInterval: 60_000,
    hangingThresholdMs: 15 * 60_000,
  },
  [QUEUE_NAMES.INGREDIENT_LINKING]: {
    jobOptions: RETRIED_TWICE,
    concurrency: 2,
    stalledInterval: 60_000,
    hangingThresholdMs: 15 * 60_000,
  },
  [QUEUE_NAMES.IMAGE_GENERATION]: {
    jobOptions: RETRIED_TWICE,
    // Image APIs are billed per call and rate-limited hard, so a library sweep
    // must trickle rather than burst: 1, not the 2 the other enrichment
    // queues run at.
    concurrency: 1,
    stalledInterval: 60_000,
    hangingThresholdMs: 15 * 60_000,
  },
  [QUEUE_NAMES.STORE_LOOKUP]: {
    // A shop that is down is down; a lookup that failed is retried once and
    // then left alone, because the grocery it was for is unpriced rather than
    // broken.
    jobOptions: { attempts: 2, backoff: { type: "exponential", delay: 10_000 } },
    // One visit at a time, paced inside the processor: this is the whole
    // good-citizen fence in front of somebody else's supermarket. Raising it,
    // or adding a second queue that races this one at the same shop, undoes it.
    concurrency: 1,
    stalledInterval: 60_000,
    hangingThresholdMs: 10 * 60_000,
    withoutOperationContext: true,
  },
  [QUEUE_NAMES.INGREDIENT_REVIEW]: {
    // The AI pass. A retry after a crash is safe: a change already made is not made twice.
    jobOptions: { attempts: 2, backoff: { type: "exponential", delay: 5_000 } },
    // One pass at a time: a pass already asks its foods a few at once.
    concurrency: 1,
    stalledInterval: 60_000,
    // A thousand foods, each within a 30 s budget, a few at a time, take well over an hour.
    hangingThresholdMs: 4 * 60 * 60_000,
  },
  [QUEUE_NAMES.INGREDIENT_ICONS]: {
    // Drawing many foods' icons. A food's own failure is recorded on its step
    // and never fails the job; a second attempt covers a crash of the job
    // itself, and is safe: a food the first attempt drew has an icon of its
    // own and is skipped, so the retry only finishes what the crash left.
    jobOptions: { attempts: 2, backoff: { type: "exponential", delay: 5_000 } },
    // One job at a time, drawing one food after another: image calls are
    // billed per request and rate-limited hard, as for Generated Images.
    concurrency: 1,
    stalledInterval: 60_000,
    // A round may draw thousands of icons, one at a time.
    hangingThresholdMs: 24 * 60 * 60_000,
  },
  [QUEUE_NAMES.INGREDIENT_FILL]: {
    // A retry after a crash is safe: a food filled already has no gap left to ask about.
    jobOptions: { attempts: 2, backoff: { type: "exponential", delay: 5_000 } },
    // One job at a time: a job already asks its foods a few at once.
    concurrency: 1,
    stalledInterval: 60_000,
    // Fill gaps over the catalogue asks thousands of foods.
    hangingThresholdMs: 24 * 60 * 60_000,
  },
};
