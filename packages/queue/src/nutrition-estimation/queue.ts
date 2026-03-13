/**
 * Nutrition Estimation Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { NutritionEstimationJobData } from "@norish/queue/contracts/job-types";

import { Queue } from "bullmq";
import { getBullClient } from "@norish/queue/redis/bullmq";

import { nutritionEstimationJobOptions, QUEUE_NAMES } from "../config";

/**
 * Create a nutrition estimation queue instance.
 * One queue instance per process is expected.
 */
export function createNutritionEstimationQueue(): Queue<NutritionEstimationJobData> {
  return new Queue<NutritionEstimationJobData>(QUEUE_NAMES.NUTRITION_ESTIMATION, {
    connection: getBullClient(),
    defaultJobOptions: nutritionEstimationJobOptions,
  });
}
