import type { NutritionEstimationJobData, AddNutritionEstimationJobResult } from "@/types";

import { Queue } from "bullmq";

import { redisConnection, nutritionEstimationJobOptions, QUEUE_NAMES } from "../config";
import { isJobInQueue } from "../helpers";

import { createLogger } from "@/server/logger";

const log = createLogger("queue:nutrition-estimation");

export const nutritionEstimationQueue = new Queue<NutritionEstimationJobData>(
  QUEUE_NAMES.NUTRITION_ESTIMATION,
  {
    connection: redisConnection,
    defaultJobOptions: nutritionEstimationJobOptions,
  }
);

function generateNutritionJobId(recipeId: string): string {
  return `nutrition_${recipeId}`;
}

export async function addNutritionEstimationJob(
  data: NutritionEstimationJobData
): Promise<AddNutritionEstimationJobResult> {
  const jobId = generateNutritionJobId(data.recipeId);

  log.debug({ recipeId: data.recipeId, jobId }, "Attempting to add nutrition estimation job");

  if (await isJobInQueue(nutritionEstimationQueue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate nutrition estimation job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await nutritionEstimationQueue.add("estimate", data, { jobId });

  log.info({ recipeId: data.recipeId, jobId: job.id }, "Nutrition estimation job added to queue");

  return { status: "queued", job };
}

export async function closeNutritionEstimationQueue(): Promise<void> {
  await nutritionEstimationQueue.close();
  log.info("Nutrition estimation queue closed");
}
