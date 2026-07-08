/**
 * Paste Import Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { PasteImportJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { pasteImportJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

/**
 * Create a paste import queue instance.
 * One queue instance per process is expected.
 */
export function createPasteImportQueue(
  removalOptions?: QueueRemovalOptions
): Queue<PasteImportJobData> {
  return createOperationAwareQueue<PasteImportJobData>(QUEUE_NAMES.PASTE_IMPORT, {
    connection: getBullClient(),
    defaultJobOptions: { ...pasteImportJobOptions, ...removalOptions },
  });
}
