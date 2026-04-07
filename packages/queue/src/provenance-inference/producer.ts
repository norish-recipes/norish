import type { Queue } from "bullmq";
import type { ProvenanceInferenceJobData, AddProvenanceInferenceJobResult } from "@norish/queue/contracts/job-types";

import { QUEUE_NAMES, provenanceInferenceJobOptions } from "../config";

// import { getQueues } from "@norish/queue/registry";
import { createLogger } from "@norish/shared-server/logger";
import { isAIEnabled } from "@norish/config/server-config-loader";

const log = createLogger("queue:provenance-inference:producer");

/**
 * Add a provenance inference job to the queue.
 *
 * Checks if AI is enabled before queueing.
 */
export async function addProvenanceInferenceJob(
  queue: Queue<ProvenanceInferenceJobData>,
  data: ProvenanceInferenceJobData
): Promise<AddProvenanceInferenceJobResult> {
  const [aiEnabled, provenanceEnabled] = await Promise.all([
    isAIEnabled(),
    import("@norish/config/server-config-loader").then((m) => m.isProvenanceEnabled()),
  ]);

  if (!aiEnabled || !provenanceEnabled) {
    log.info(
      { recipeId: data.recipeId, aiEnabled, provenanceEnabled },
      "Provenance inference disabled, skipping job"
    );

    return { status: "skipped", reason: "disabled" };
  }

  // Use underscore instead of colon to avoid BullMQ validation error "Custom Id cannot contain :"
  const jobId = `provenance-inference_${data.recipeId}`;

  const existingJob = await queue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();

    // If job is already processing or waiting, don't add duplicate
    if (
      state === "active" ||
      state === "waiting" ||
      state === "delayed" ||
      state === "prioritized"
    ) {
      log.info(
        { recipeId: data.recipeId, jobId, state },
        "Provenance inference job already exists"
      );

      return { status: "duplicate", existingJobId: existingJob.id || jobId };
    }

    // If job is completed or failed, remove it so we can re-run
    // This allows manual re-triggering via the UI
    await existingJob.remove();
    log.info(
      { recipeId: data.recipeId, jobId, state },
      "Removed existing provenance inference job to re-run"
    );
  }

  const job = await queue.add(QUEUE_NAMES.PROVENANCE_INFERENCE, data, {
    ...provenanceInferenceJobOptions,
    jobId,
  });

  log.info({ recipeId: data.recipeId, jobId: job.id }, "Provenance inference job added to queue");

  return { status: "queued", job };
}
