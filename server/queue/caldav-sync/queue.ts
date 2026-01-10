/**
 * CalDAV Sync Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { CaldavSyncJobData } from "@/types";

import { Queue } from "bullmq";

import { caldavSyncJobOptions, QUEUE_NAMES } from "../config";

import { getBullClient } from "@/server/redis/bullmq";

/**
 * Create a CalDAV sync queue instance.
 * One queue instance per process is expected.
 */
export function createCaldavSyncQueue(): Queue<CaldavSyncJobData> {
  return new Queue<CaldavSyncJobData>(QUEUE_NAMES.CALDAV_SYNC, {
    connection: getBullClient(),
    defaultJobOptions: caldavSyncJobOptions,
  });
}
