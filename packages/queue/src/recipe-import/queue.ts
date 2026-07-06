/**
 * Recipe Import Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { RecipeImportJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import { QUEUE_NAMES, recipeImportJobOptions } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

/**
 * Create a recipe import queue instance.
 * One queue instance per process is expected.
 */
export function createRecipeImportQueue(): Queue<RecipeImportJobData> {
  return createOperationAwareQueue<RecipeImportJobData>(QUEUE_NAMES.RECIPE_IMPORT, {
    connection: getBullClient(),
    defaultJobOptions: recipeImportJobOptions,
  });
}
