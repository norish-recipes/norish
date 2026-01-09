/**
 * Auto-Tagging Producer - Application Logic
 *
 * Enqueue logic for auto-tagging jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import type { Queue } from "bullmq";
import type { AutoTaggingJobData, AddAutoTaggingJobResult } from "@/types";

import { isJobInQueue } from "../helpers";

import { createLogger } from "@/server/logger";
import { getAutoTaggingMode } from "@/config/server-config-loader";

const log = createLogger("queue:auto-tagging");

/**
 * Add an auto-tagging job to the queue.
 * Returns "skipped" if auto-tagging is disabled.
 * Returns "duplicate" if a job already exists in queue.
 */
export async function addAutoTaggingJob(
  queue: Queue<AutoTaggingJobData>,
  data: AutoTaggingJobData
): Promise<AddAutoTaggingJobResult> {
  // Check if auto-tagging is enabled
  const autoTaggingMode = await getAutoTaggingMode();

  if (autoTaggingMode === "disabled") {
    return { status: "skipped", reason: "disabled" };
  }

  const jobId = `auto-tag-${data.recipeId}`;

  log.debug({ recipeId: data.recipeId, jobId }, "Attempting to add auto-tagging job");

  if (await isJobInQueue(queue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate auto-tagging job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await queue.add("auto-tag", data, { jobId });

  log.info({ recipeId: data.recipeId, jobId: job.id }, "Auto-tagging job added to queue");

  return { status: "queued", job };
}

/**
 * Check if an auto-tagging job is currently active for the given recipe.
 */
export async function isAutoTaggingJobActive(
  queue: Queue<AutoTaggingJobData>,
  recipeId: string
): Promise<boolean> {
  const jobId = `auto-tag-${recipeId}`;

  return isJobInQueue(queue, jobId);
}
