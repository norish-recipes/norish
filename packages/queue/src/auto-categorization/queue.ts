import type { Queue } from "bullmq";

import type { AutoCategorizationJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import { autoCategorizationJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

export function createAutoCategorizationQueue(): Queue<AutoCategorizationJobData> {
  return createOperationAwareQueue<AutoCategorizationJobData>(QUEUE_NAMES.AUTO_CATEGORIZATION, {
    connection: getBullClient(),
    defaultJobOptions: autoCategorizationJobOptions,
  });
}
