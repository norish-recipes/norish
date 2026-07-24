import type { Queue } from "bullmq";

import type { AddProvenanceJobResult, ProvenanceJobData } from "@norish/queue/contracts/job-types";
import { isAIEnabled } from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";

import { isJobInQueue } from "../helpers";

const log = createLogger("queue:provenance");

/** Deterministic per-recipe job id so at most one provenance job exists per recipe. */
export function provenanceJobId(recipeId: string): string {
  return `provenance-${recipeId}`;
}

/**
 * Queue a Recipe Provenance inference job. Returns a typed outcome without
 * waiting for inference: `skipped` when AI is disabled, `duplicate` when a job
 * is already in flight, otherwise `queued`. Callers must not treat a failure to
 * queue as a reason to roll back an already-successful import.
 */
export async function addProvenanceJob(
  queue: Queue<ProvenanceJobData>,
  data: ProvenanceJobData
): Promise<AddProvenanceJobResult> {
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    return { status: "skipped", reason: "disabled" };
  }

  const jobId = provenanceJobId(data.recipeId);

  log.debug({ recipeId: data.recipeId, jobId }, "Attempting to add provenance job");

  if (await isJobInQueue(queue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate provenance job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await queue.add("infer-provenance", data, { jobId });

  log.info({ recipeId: data.recipeId, jobId: job.id }, "Provenance job added to queue");

  return { status: "queued", job };
}
