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

import { recipeImportDeduplicationId } from "../helpers";

const log = createLogger("queue:recipe-import");

/**
 * Add a recipe import job to the queue.
 * First checks if recipe already exists in DB (policy-aware).
 * Returns conflict status while an import of the same URL is still in flight:
 * the URL's id is BullMQ's deduplication id, which it frees once that import
 * finishes, so a finished import kept in the history never blocks a new one.
 */
export async function addImportJob(
  queue: Queue<RecipeImportJobData>,
  data: RecipeImportJobData
): Promise<AddImportJobResult> {
  const policy = await getRecipePermissionPolicy();
  const deduplicationId = recipeImportDeduplicationId(
    data.url,
    data.userId,
    data.householdKey,
    policy.view
  );

  log.debug(
    { url: data.url, deduplicationId, policy: policy.view },
    "Attempting to add import job"
  );

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

  const job = await queue.add("import", data, {
    jobId: data.recipeId,
    deduplication: { id: deduplicationId },
  });

  // BullMQ answers a deduplicated add with the job already holding the id.
  if (job.id && job.id !== data.recipeId) {
    log.warn({ url: data.url, existingJobId: job.id }, "Duplicate import job rejected");

    return { status: "duplicate", existingJobId: job.id };
  }

  log.info(
    { url: data.url, jobId: job.id, recipeId: data.recipeId },
    "Recipe import job added to queue"
  );

  return { status: "queued", job };
}
