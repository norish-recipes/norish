/**
 * Recipe Enrichment producer.
 *
 * Owns queue mechanics and duplicate detection only. It deliberately does not
 * read the automatic enablement settings: doing that inside the producer is
 * what previously made manual availability depend on automatic policy. Whether
 * a kind should run at all is the coordinator's decision.
 */

import { randomUUID } from "node:crypto";
import type { Queue } from "bullmq";

import type {
  RecipeEnrichmentEnrollment,
  RecipeEnrichmentKind,
} from "@norish/shared/lib/recipe-enrichment";
import { createLogger } from "@norish/shared-server/logger";

import type { RecipeEnrichmentJobData } from "../contracts/job-types";
import { publishEnrichmentLifecycle } from "./announce";
import { ENRICHMENT_JOB_NAMES, enrichmentJobId, findActiveEnrichmentJobId } from "./identity";

const log = createLogger("queue:enrichment");

/**
 * Enqueue one enrichment job.
 *
 * A retained terminal job for the same recipe and kind is removed first, so
 * history retention never blocks a rerun while an in-flight job still does.
 */
export async function addEnrichmentJob(
  queue: Queue<RecipeEnrichmentJobData>,
  data: RecipeEnrichmentJobData
): Promise<RecipeEnrichmentEnrollment> {
  const { kind, recipeId } = data;
  const jobId = enrichmentJobId(kind, recipeId);

  const activeJobId = await findActiveEnrichmentJobId(queue, kind, recipeId);

  if (activeJobId) {
    log.debug({ recipeId, kind, jobId, origin: data.origin }, "Enrichment job already in flight");

    return { kind, status: "duplicate", existingJobId: activeJobId };
  }

  if (data.origin === "manual") {
    // A deliberate rerun clears the retained terminal job so history cannot
    // block it. Automatic enrollment deliberately does not: a duplicate
    // creation event must coalesce onto the completed run, not re-spend AI.
    await removeRetainedJob(queue, jobId, kind, recipeId);
  } else if (await queue.getJob(jobId)) {
    // Automatic creation signals can be delivered more than once. A retained
    // terminal run proves this recipe and kind were already enrolled, so do
    // not ask BullMQ to re-add the occupied deterministic id and then claim a
    // new queued transition that will never run.
    return { kind, status: "duplicate", existingJobId: jobId };
  }

  const redis = await queue.client;
  const runSequence = await redis.incr(queue.toKey("enrichment-run-sequence"));
  const runData = { ...data, runId: data.runId ?? randomUUID(), runSequence };
  const job = await queue.add(ENRICHMENT_JOB_NAMES[kind], runData, { jobId });
  const storedRun = await queue.getJob(jobId);

  if (storedRun?.data?.runId && storedRun.data.runId !== runData.runId) {
    // Another producer won the deterministic-id race between our preflight
    // read and BullMQ's atomic add. That run is real; ours is not, so do not
    // publish a phantom run identity or tell a manual caller it started.
    return { kind, status: "duplicate", existingJobId: jobId };
  }

  // Enrollment is already durable at this point. Realtime is an acceleration
  // path, so publish without making an emission failure turn accepted work
  // into a false failed-to-queue outcome. Clients reject a delayed queued event
  // once a later state has already arrived.
  void publishEnrichmentLifecycle(runData, "queued").catch((err) => {
    log.warn({ err, recipeId, kind, jobId }, "Failed to publish queued enrichment state");
  });

  log.info({ recipeId, kind, jobId: job.id, origin: data.origin }, "Enrichment job queued");

  return { kind, status: "queued", jobId: job.id ?? jobId };
}

async function removeRetainedJob(
  queue: Queue<RecipeEnrichmentJobData>,
  jobId: string,
  kind: RecipeEnrichmentKind,
  recipeId: string
): Promise<void> {
  const retained = await queue.getJob(jobId);

  if (!retained) return;

  try {
    await retained.remove();
  } catch (err) {
    // Returning queued here would be false: BullMQ can keep the retained job
    // under the same deterministic id and treat the later add as a no-op.
    log.warn({ err, recipeId, kind, jobId }, "Could not remove retained enrichment job");
    throw new Error("Could not replace retained enrichment job", { cause: err });
  }
}
