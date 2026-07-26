import type { Queue } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { autoCategorizationJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

export function createAutoCategorizationQueue(
  removalOptions?: QueueRemovalOptions
): Queue<RecipeEnrichmentJobData> {
  return createOperationAwareQueue<RecipeEnrichmentJobData>(QUEUE_NAMES.AUTO_CATEGORIZATION, {
    connection: getBullClient(),
    defaultJobOptions: { ...autoCategorizationJobOptions, ...removalOptions },
  });
}
