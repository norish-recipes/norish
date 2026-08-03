/**
 * Ingredient Linking Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { ingredientLinkingJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

/**
 * Create an Ingredient Linking queue instance.
 * One queue instance per process is expected.
 */
export function createIngredientLinkingQueue(
  removalOptions?: QueueRemovalOptions
): Queue<RecipeEnrichmentJobData> {
  return createOperationAwareQueue<RecipeEnrichmentJobData>(QUEUE_NAMES.INGREDIENT_LINKING, {
    connection: getBullClient(),
    defaultJobOptions: { ...ingredientLinkingJobOptions, ...removalOptions },
  });
}
