/**
 * CalDAV Sync Queue
 *
 * Manages CalDAV sync operations with deduplication and retry.
 */

import type { CaldavSyncJobData } from "@/types";

import { Queue, Job } from "bullmq";

import { redisConnection, caldavSyncJobOptions, QUEUE_NAMES } from "../config";
import { sanitizeUrlForJobId } from "../helpers";

import { createLogger } from "@/server/logger";

const log = createLogger("queue:caldav-sync");

/**
 * CalDAV sync queue instance
 */
export const caldavSyncQueue = new Queue<CaldavSyncJobData>(QUEUE_NAMES.CALDAV_SYNC, {
  connection: redisConnection,
  defaultJobOptions: caldavSyncJobOptions,
});

/**
 * Generate a unique job ID based on CalDAV server URL and item ID.
 * This prevents duplicate sync operations for the same item to the same calendar.
 */
function generateCaldavJobId(caldavServerUrl: string, itemId: string): string {
  const sanitizedUrl = sanitizeUrlForJobId(caldavServerUrl);
  return `caldav_${sanitizedUrl}_${itemId}`;
}

/**
 * Add a CalDAV sync job to the queue.
 * Supersedes any existing job for the same item on the same calendar.
 *
 * @returns The created job
 */
export async function addCaldavSyncJob(data: CaldavSyncJobData): Promise<Job<CaldavSyncJobData>> {
  const jobId = generateCaldavJobId(data.caldavServerUrl, data.itemId);

  // Supersede any existing job for this item (only sync latest state)
  const existingJob = await caldavSyncQueue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === "waiting" || state === "delayed") {
      await existingJob.remove();
      log.debug({ jobId, itemId: data.itemId }, "Superseded existing CalDAV sync job");
    }
  }

  const job = await caldavSyncQueue.add("sync", data, { jobId });

  log.info(
    { jobId: job.id, itemId: data.itemId, operation: data.operation },
    "CalDAV sync job added to queue"
  );

  return job;
}

/**
 * Close the queue connection gracefully.
 * Call during server shutdown.
 */
export async function closeCaldavSyncQueue(): Promise<void> {
  await caldavSyncQueue.close();
  log.info("CalDAV sync queue closed");
}
