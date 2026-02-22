import type { AutoCategorizationJobData } from "@norish/queue/contracts/job-types";

import { Queue } from "bullmq";

import { autoCategorizationJobOptions, QUEUE_NAMES } from "../config";

import { getBullClient } from "@norish/queue/redis/bullmq";

export function createAutoCategorizationQueue(): Queue<AutoCategorizationJobData> {
  return new Queue<AutoCategorizationJobData>(QUEUE_NAMES.AUTO_CATEGORIZATION, {
    connection: getBullClient(),
    defaultJobOptions: autoCategorizationJobOptions,
  });
}
