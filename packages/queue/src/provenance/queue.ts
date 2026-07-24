import type { Queue } from "bullmq";

import type { ProvenanceJobData } from "@norish/queue/contracts/job-types";
import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { provenanceJobOptions, QUEUE_NAMES } from "../config";
import { createOperationAwareQueue } from "../operation-aware-queue";

export function createProvenanceQueue(
  removalOptions?: QueueRemovalOptions
): Queue<ProvenanceJobData> {
  return createOperationAwareQueue<ProvenanceJobData>(QUEUE_NAMES.PROVENANCE, {
    connection: getBullClient(),
    defaultJobOptions: { ...provenanceJobOptions, ...removalOptions },
  });
}
