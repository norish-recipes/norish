/**
 * Store Lookup Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import { Queue } from "bullmq";

import type { StoreLookupJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { QUEUE_NAMES, storeLookupJobOptions } from "../config";

export function createStoreLookupQueue(
  removalOptions?: QueueRemovalOptions
): Queue<StoreLookupJobData> {
  return new Queue<StoreLookupJobData>(QUEUE_NAMES.STORE_LOOKUP, {
    connection: getBullClient(),
    defaultJobOptions: { ...storeLookupJobOptions, ...removalOptions },
  });
}
