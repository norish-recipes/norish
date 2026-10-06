/**
 * Ingredient Icons Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { IngredientIconsJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { ingredientIconsJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

export function createIngredientIconsQueue(
  removalOptions?: QueueRemovalOptions
): Queue<IngredientIconsJobData> {
  return createOperationAwareQueue<IngredientIconsJobData>(QUEUE_NAMES.INGREDIENT_ICONS, {
    connection: getBullClient(),
    defaultJobOptions: { ...ingredientIconsJobOptions, ...removalOptions },
  });
}
