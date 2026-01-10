/**
 * Nutrition Estimation Producer - Application Logic
 *
 * Enqueue logic for nutrition estimation jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import type { Queue } from "bullmq";
import type { NutritionEstimationJobData, AddNutritionEstimationJobResult } from "@/types";

import { isJobInQueue } from "../helpers";

import { createLogger } from "@/server/logger";

const log = createLogger("queue:nutrition-estimation");

function generateNutritionJobId(recipeId: string): string {
  return `nutrition_${recipeId}`;
}

/**
 * Add a nutrition estimation job to the queue.
 * Returns conflict status if a duplicate job already exists.
 */
export async function addNutritionEstimationJob(
  queue: Queue<NutritionEstimationJobData>,
  data: NutritionEstimationJobData
): Promise<AddNutritionEstimationJobResult> {
  const jobId = generateNutritionJobId(data.recipeId);

  log.debug({ recipeId: data.recipeId, jobId }, "Attempting to add nutrition estimation job");

  if (await isJobInQueue(queue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate nutrition estimation job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await queue.add("estimate", data, { jobId });

  log.info({ recipeId: data.recipeId, jobId: job.id }, "Nutrition estimation job added to queue");

  return { status: "queued", job };
}
