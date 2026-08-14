/**
 * Recipe Import Producer - Application Logic
 *
 * Enqueue logic for recipe import jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import type { Queue } from "bullmq";

import type { AddImportJobResult, RecipeImportJobData } from "@norish/queue/contracts/job-types";
import { recipeExistsByUrlForPolicy } from "@norish/db";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";

import { generateJobId, isJobInQueue, removeRetainedTerminalJob } from "../helpers";

const log = createLogger("queue:recipe-import");

/**
 * Add a recipe import job to the queue.
 * First checks if recipe already exists in DB (policy-aware).
 * Returns conflict status if a duplicate job already exists in queue.
 */
export async function addImportJob(
  queue: Queue<RecipeImportJobData>,
  data: RecipeImportJobData
): Promise<AddImportJobResult> {
  const policy = await getRecipePermissionPolicy();
  const jobId = generateJobId(data.url, data.userId, data.householdKey, policy.view);

  log.debug({ url: data.url, jobId, policy: policy.view }, "Attempting to add import job");

  const existingCheck = await recipeExistsByUrlForPolicy(
    data.url,
    data.userId,
    data.householdUserIds,
    policy.view
  );

  if (existingCheck.exists && existingCheck.existingRecipeId) {
    log.info(
      { url: data.url, existingRecipeId: existingCheck.existingRecipeId },
      "Recipe already exists in DB, skipping queue"
    );

    return { status: "exists", existingRecipeId: existingCheck.existingRecipeId };
  }

  if (await isJobInQueue(queue, jobId)) {
    log.warn({ url: data.url, jobId }, "Duplicate import job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  // A completed or failed job retained for history still occupies the
  // deterministic id, and BullMQ would silently ignore the add below.
  const removed = await removeRetainedTerminalJob(queue, jobId);

  if (removed) {
    log.info({ url: data.url, jobId }, "Removed retained terminal job to free import job id");
  }

  const job = await queue.add("import", data, { jobId });
  const stored = await queue.getJob(jobId);

  if (stored && stored.data.recipeId !== data.recipeId) {
    // Another producer won the deterministic-id race between our checks and
    // BullMQ's atomic add: its job is the real one and ours was ignored.
    log.warn({ url: data.url, jobId }, "Import job id claimed by a concurrent add");

    return { status: "duplicate", existingJobId: jobId };
  }

  log.info(
    { url: data.url, jobId: job.id, recipeId: data.recipeId },
    "Recipe import job added to queue"
  );

  return { status: "queued", job };
}
