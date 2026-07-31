/**
 * Nutrition Estimation Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { nutritionEstimationJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

/**
 * Create a nutrition estimation queue instance.
 * One queue instance per process is expected.
 */
export function createNutritionEstimationQueue(
  removalOptions?: QueueRemovalOptions
): Queue<RecipeEnrichmentJobData> {
  return createOperationAwareQueue<RecipeEnrichmentJobData>(QUEUE_NAMES.NUTRITION_ESTIMATION, {
    connection: getBullClient(),
    defaultJobOptions: { ...nutritionEstimationJobOptions, ...removalOptions },
  });
}
