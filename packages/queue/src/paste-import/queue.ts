/**
 * Paste Import Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { PasteImportJobData } from "@norish/queue/contracts/job-types";

import { Queue } from "bullmq";
import { getBullClient } from "@norish/queue/redis/bullmq";

import { pasteImportJobOptions, QUEUE_NAMES } from "../config";

/**
 * Create a paste import queue instance.
 * One queue instance per process is expected.
 */
export function createPasteImportQueue(): Queue<PasteImportJobData> {
  return new Queue<PasteImportJobData>(QUEUE_NAMES.PASTE_IMPORT, {
    connection: getBullClient(),
    defaultJobOptions: pasteImportJobOptions,
  });
}
