/**
 * Auto-Tagging Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { AutoTaggingJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import { autoTaggingJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

/**
 * Create an auto-tagging queue instance.
 * One queue instance per process is expected.
 */
export function createAutoTaggingQueue(): Queue<AutoTaggingJobData> {
  return createOperationAwareQueue<AutoTaggingJobData>(QUEUE_NAMES.AUTO_TAGGING, {
    connection: getBullClient(),
    defaultJobOptions: autoTaggingJobOptions,
  });
}
