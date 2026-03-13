/**
 * Auto-Tagging Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { AutoTaggingJobData } from "@norish/queue/contracts/job-types";

import { Queue } from "bullmq";
import { getBullClient } from "@norish/queue/redis/bullmq";

import { autoTaggingJobOptions, QUEUE_NAMES } from "../config";

/**
 * Create an auto-tagging queue instance.
 * One queue instance per process is expected.
 */
export function createAutoTaggingQueue(): Queue<AutoTaggingJobData> {
  return new Queue<AutoTaggingJobData>(QUEUE_NAMES.AUTO_TAGGING, {
    connection: getBullClient(),
    defaultJobOptions: autoTaggingJobOptions,
  });
}
