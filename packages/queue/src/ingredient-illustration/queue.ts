/**
 * Ingredient Illustration Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import { Queue } from "bullmq";

import type { IngredientIllustrationJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { ingredientIllustrationJobOptions, QUEUE_NAMES } from "../config";

export function createIngredientIllustrationQueue(
  removalOptions?: QueueRemovalOptions
): Queue<IngredientIllustrationJobData> {
  return new Queue<IngredientIllustrationJobData>(QUEUE_NAMES.INGREDIENT_ILLUSTRATION, {
    connection: getBullClient(),
    defaultJobOptions: { ...ingredientIllustrationJobOptions, ...removalOptions },
  });
}
