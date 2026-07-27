/**
 * Recipe AI Edit Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { RecipeAiEditJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { QUEUE_NAMES, recipeAiEditJobOptions } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

/**
 * Create a recipe AI edit queue instance.
 * One queue instance per process is expected.
 */
export function createRecipeAiEditQueue(
  removalOptions?: QueueRemovalOptions
): Queue<RecipeAiEditJobData> {
  return createOperationAwareQueue<RecipeAiEditJobData>(QUEUE_NAMES.RECIPE_AI_EDIT, {
    connection: getBullClient(),
    defaultJobOptions: { ...recipeAiEditJobOptions, ...removalOptions },
  });
}
