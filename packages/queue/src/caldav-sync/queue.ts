/**
 * CalDAV Sync Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { CaldavSyncJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import { caldavSyncJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

/**
 * Create a CalDAV sync queue instance.
 * One queue instance per process is expected.
 */
export function createCaldavSyncQueue(): Queue<CaldavSyncJobData> {
  return createOperationAwareQueue<CaldavSyncJobData>(QUEUE_NAMES.CALDAV_SYNC, {
    connection: getBullClient(),
    defaultJobOptions: caldavSyncJobOptions,
  });
}
