import type { AutoTaggingJobData, AddAutoTaggingJobResult } from "@/types";

import { Queue } from "bullmq";

import { autoTaggingJobOptions, QUEUE_NAMES } from "../config";
import { isJobInQueue } from "../helpers";

import { getBullClient } from "@/server/redis/bullmq";
import { createLogger } from "@/server/logger";
import { getAutoTaggingMode } from "@/config/server-config-loader";

const log = createLogger("queue:auto-tagging");

/**
 * Auto-tagging queue instance
 */
export const autoTaggingQueue = new Queue<AutoTaggingJobData>(QUEUE_NAMES.AUTO_TAGGING, {
  connection: getBullClient(),
  defaultJobOptions: autoTaggingJobOptions,
});

/**
 * Add an auto-tagging job to the queue.
 * Returns "skipped" if auto-tagging is disabled.
 * Returns "duplicate" if a job already exists in queue.
 */
export async function addAutoTaggingJob(
  data: AutoTaggingJobData
): Promise<AddAutoTaggingJobResult> {
  // Check if auto-tagging is enabled
  const autoTaggingMode = await getAutoTaggingMode();

  if (autoTaggingMode === "disabled") {
    return { status: "skipped", reason: "disabled" };
  }

  const jobId = `auto-tag-${data.recipeId}`;

  log.debug({ recipeId: data.recipeId, jobId }, "Attempting to add auto-tagging job");

  if (await isJobInQueue(autoTaggingQueue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate auto-tagging job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await autoTaggingQueue.add("auto-tag", data, { jobId });

  log.info({ recipeId: data.recipeId, jobId: job.id }, "Auto-tagging job added to queue");

  return { status: "queued", job };
}

/**
 * Close the queue connection gracefully.
 * Call during server shutdown.
 */
export async function closeAutoTaggingQueue(): Promise<void> {
  await autoTaggingQueue.close();
  log.info("Auto-tagging queue closed");
}

/**
 * Check if an auto-tagging job is currently active for the given recipe.
 */
export async function isAutoTaggingJobActive(recipeId: string): Promise<boolean> {
  const jobId = `auto-tag-${recipeId}`;

  return isJobInQueue(autoTaggingQueue, jobId);
}
