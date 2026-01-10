/**
 * Recipe Import Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { RecipeImportJobData } from "@/types";

import { Queue } from "bullmq";

import { recipeImportJobOptions, QUEUE_NAMES } from "../config";

import { getBullClient } from "@/server/redis/bullmq";

/**
 * Create a recipe import queue instance.
 * One queue instance per process is expected.
 */
export function createRecipeImportQueue(): Queue<RecipeImportJobData> {
  return new Queue<RecipeImportJobData>(QUEUE_NAMES.RECIPE_IMPORT, {
    connection: getBullClient(),
    defaultJobOptions: recipeImportJobOptions,
  });
}
