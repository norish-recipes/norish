/**
 * Recipe Enrichment producer.
 *
 * Owns queue mechanics and duplicate detection only. It deliberately does not
 * read the automatic enablement settings: doing that inside the producer is
 * what previously made manual availability depend on automatic policy. Whether
 * a kind should run at all is the coordinator's decision.
 */

import type { Queue } from "bullmq";

import type {
  RecipeEnrichmentEnrollment,
  RecipeEnrichmentKind,
} from "@norish/shared/lib/recipe-enrichment";
import { createLogger } from "@norish/shared-server/logger";

import type { RecipeEnrichmentJobData } from "../contracts/job-types";
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

  await removeRetainedJob(queue, jobId, kind, recipeId);

  const job = await queue.add(ENRICHMENT_JOB_NAMES[kind], data, { jobId });

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
    // A concurrent producer may have removed or restarted it between our state
    // read and this call. Adding with the same id is idempotent either way.
    log.debug({ err, recipeId, kind, jobId }, "Could not remove retained enrichment job");
  }
}
