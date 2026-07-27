/**
 * Recipe AI Edit Producer - Application Logic
 *
 * Enqueue logic for recipe AI edit jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import type { Queue } from "bullmq";

import type {
  AddRecipeAiEditJobResult,
  RecipeAiEditJobData,
} from "@norish/queue/contracts/job-types";
import { createLogger } from "@norish/shared-server/logger";

import { isJobInQueue } from "../helpers";

const log = createLogger("queue:recipe-ai-edit");

/**
 * Add a recipe AI edit job to the queue.
 * Returns "duplicate" if an edit is already in progress for this recipe.
 */
export async function addRecipeAiEditJob(
  queue: Queue<RecipeAiEditJobData>,
  data: RecipeAiEditJobData
): Promise<AddRecipeAiEditJobResult> {
  const jobId = `ai-edit-${data.recipeId}`;

  log.debug({ recipeId: data.recipeId, jobId }, "Attempting to add recipe AI edit job");

  if (await isJobInQueue(queue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate recipe AI edit job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  // A previous edit's completed/failed job may still be retained in Redis under
  // this recipe-scoped id; BullMQ would treat re-adding it as a no-op and the
  // new edit would never run. The job is not waiting/active/delayed (checked
  // above), so removing it here only clears a finished record.
  await queue.remove(jobId);

  const job = await queue.add("ai-edit", data, { jobId });

  log.info({ recipeId: data.recipeId, jobId: job.id }, "Recipe AI edit job added to queue");

  return { status: "queued", job };
}

/**
 * Check if a recipe AI edit job is currently active for the given recipe.
 */
export async function isRecipeAiEditJobActive(
  queue: Queue<RecipeAiEditJobData>,
  recipeId: string
): Promise<boolean> {
  const jobId = `ai-edit-${recipeId}`;

  return isJobInQueue(queue, jobId);
}
