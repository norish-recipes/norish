import type { RecipeImportJobData, AddImportJobResult } from "@/types";

import { Queue } from "bullmq";

import { redisConnection, recipeImportJobOptions, QUEUE_NAMES } from "../config";
import { generateJobId, isJobInQueue } from "../helpers";

import { createLogger } from "@/server/logger";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";
import { recipeExistsByUrlForPolicy } from "@/server/db";

const log = createLogger("queue:recipe-import");

/**
 * Recipe import queue instance
 */
export const recipeImportQueue = new Queue<RecipeImportJobData>(
  QUEUE_NAMES.RECIPE_IMPORT,
  {
    connection: redisConnection,
    defaultJobOptions: recipeImportJobOptions,
  }
);

/**
 * Add a recipe import job to the queue.
 * First checks if recipe already exists in DB (policy-aware).
 * Returns conflict status if a duplicate job already exists in queue.
 *
 * @returns Object with status and either job or existingRecipeId
 */
export async function addImportJob(
  data: RecipeImportJobData
): Promise<AddImportJobResult> {
  const policy = await getRecipePermissionPolicy();
  const jobId = generateJobId(data.url, data.userId, data.householdKey, policy.view);

  log.debug(
    { url: data.url, jobId, policy: policy.view },
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

  if (await isJobInQueue(recipeImportQueue, jobId)) {
    log.warn({ url: data.url, jobId }, "Duplicate import job rejected");
    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await recipeImportQueue.add("import", data, { jobId });

  log.info(
    { url: data.url, jobId: job.id, recipeId: data.recipeId },
    "Recipe import job added to queue"
  );

  return { status: "queued", job };
}

/**
 * Close the queue connection gracefully.
 * Call during server shutdown.
 */
export async function closeRecipeImportQueue(): Promise<void> {
  await recipeImportQueue.close();
  log.info("Recipe import queue closed");
}
