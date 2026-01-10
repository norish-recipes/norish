/**
 * Image Import Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { ImageImportJobData } from "@/types";

import { Queue } from "bullmq";

import { QUEUE_NAMES, imageImportJobOptions } from "../config";

import { getBullClient } from "@/server/redis/bullmq";

/**
 * Create an image import queue instance.
 * One queue instance per process is expected.
 */
export function createImageImportQueue(): Queue<ImageImportJobData> {
  return new Queue<ImageImportJobData>(QUEUE_NAMES.IMAGE_IMPORT, {
    connection: getBullClient(),
    defaultJobOptions: imageImportJobOptions,
  });
}
