/**
 * Image Import Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { ImageImportJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import { imageImportJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

/**
 * Create an image import queue instance.
 * One queue instance per process is expected.
 */
export function createImageImportQueue(): Queue<ImageImportJobData> {
  return createOperationAwareQueue<ImageImportJobData>(QUEUE_NAMES.IMAGE_IMPORT, {
    connection: getBullClient(),
    defaultJobOptions: imageImportJobOptions,
  });
}
