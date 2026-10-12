/**
 * New Ingredients Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { NewIngredientsJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { newIngredientsJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

export function createNewIngredientsQueue(
  removalOptions?: QueueRemovalOptions
): Queue<NewIngredientsJobData> {
  return createOperationAwareQueue<NewIngredientsJobData>(QUEUE_NAMES.NEW_INGREDIENTS, {
    connection: getBullClient(),
    defaultJobOptions: { ...newIngredientsJobOptions, ...removalOptions },
  });
}
