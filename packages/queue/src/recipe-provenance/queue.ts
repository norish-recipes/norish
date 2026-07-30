/**
 * Recipe Provenance Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { Queue } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { QUEUE_NAMES, recipeProvenanceJobOptions } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

/**
 * Create a Recipe Provenance queue instance.
 * One queue instance per process is expected.
 */
export function createRecipeProvenanceQueue(
  removalOptions?: QueueRemovalOptions
): Queue<RecipeEnrichmentJobData> {
  return createOperationAwareQueue<RecipeEnrichmentJobData>(QUEUE_NAMES.RECIPE_PROVENANCE, {
    connection: getBullClient(),
    defaultJobOptions: { ...recipeProvenanceJobOptions, ...removalOptions },
  });
}
