import type { ProvenanceInferenceJobData } from "@norish/queue/contracts/job-types";

import { Queue } from "bullmq";

import { QUEUE_NAMES, provenanceInferenceJobOptions } from "../config";

import { getBullClient } from "../redis/bullmq";

let provenanceInferenceQueue: any = null;

export function createProvenanceInferenceQueue() {
  if (provenanceInferenceQueue) return provenanceInferenceQueue;

  provenanceInferenceQueue = new Queue<ProvenanceInferenceJobData>(
    QUEUE_NAMES.PROVENANCE_INFERENCE,
    {
      connection: getBullClient() as any,
      defaultJobOptions: provenanceInferenceJobOptions,
    }
  );

  return provenanceInferenceQueue;
}
