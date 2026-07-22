/**
 * Image Import Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { ImageImportJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { imageImportJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

/**
 * Create an image import queue instance.
 * One queue instance per process is expected.
 */
export function createImageImportQueue(
  removalOptions?: QueueRemovalOptions
): Queue<ImageImportJobData> {
  const defaultJobOptions = { ...imageImportJobOptions, ...removalOptions };

  // Completed image jobs carry base64 payloads; cap their age at 1h
  // regardless of the configured retention to bound Redis memory.
  if (
    typeof defaultJobOptions.removeOnComplete === "object" &&
    defaultJobOptions.removeOnComplete.age !== undefined
  ) {
    defaultJobOptions.removeOnComplete = {
      ...defaultJobOptions.removeOnComplete,
      age: Math.min(3600, defaultJobOptions.removeOnComplete.age),
    };
  }

  return createOperationAwareQueue<ImageImportJobData>(QUEUE_NAMES.IMAGE_IMPORT, {
    connection: getBullClient(),
    defaultJobOptions,
  });
}
