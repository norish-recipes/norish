/**
 * Nutrition Estimation Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { NutritionEstimationJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import { nutritionEstimationJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

/**
 * Create a nutrition estimation queue instance.
 * One queue instance per process is expected.
 */
export function createNutritionEstimationQueue(): Queue<NutritionEstimationJobData> {
  return createOperationAwareQueue<NutritionEstimationJobData>(QUEUE_NAMES.NUTRITION_ESTIMATION, {
    connection: getBullClient(),
    defaultJobOptions: nutritionEstimationJobOptions,
  });
}
