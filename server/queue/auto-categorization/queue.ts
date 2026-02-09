import type { AutoCategorizationJobData } from "@/types";

import { Queue } from "bullmq";

import { autoCategorizationJobOptions, QUEUE_NAMES } from "../config";

import { getBullClient } from "@/server/redis/bullmq";

export function createAutoCategorizationQueue(): Queue<AutoCategorizationJobData> {
  return new Queue<AutoCategorizationJobData>(QUEUE_NAMES.AUTO_CATEGORIZATION, {
    connection: getBullClient(),
    defaultJobOptions: autoCategorizationJobOptions,
  });
}
