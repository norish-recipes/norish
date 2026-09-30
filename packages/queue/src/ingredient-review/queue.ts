/**
 * Ingredient Review Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { IngredientReviewJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { ingredientReviewJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

export function createIngredientReviewQueue(
  removalOptions?: QueueRemovalOptions
): Queue<IngredientReviewJobData> {
  return createOperationAwareQueue<IngredientReviewJobData>(QUEUE_NAMES.INGREDIENT_REVIEW, {
    connection: getBullClient(),
    defaultJobOptions: { ...ingredientReviewJobOptions, ...removalOptions },
  });
}
