/**
 * Image Import Producer - Application Logic
 *
 * Enqueue logic for image import jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import { randomUUID } from "node:crypto";
import type { Queue } from "bullmq";

import type {
  AddImageImportJobResult,
  ImageImportJobData,
} from "@norish/queue/contracts/job-types";
import { createLogger } from "@norish/shared-server/logger";

const log = createLogger("queue:image-import");

/**
 * Add an image import job to the queue. Its recipe is BullMQ's deduplication
 * id, freed once the import finishes: an add for a recipe whose import is
 * still in flight is answered as a duplicate.
 */
export async function addImageImportJob(
  queue: Queue<ImageImportJobData>,
  data: ImageImportJobData
): Promise<AddImageImportJobResult> {
  const jobId = randomUUID();

  log.debug(
    { recipeId: data.recipeId, jobId, fileCount: data.files.length },
    "Adding image import job"
  );

  const job = await queue.add("image-import", data, {
    jobId,
    deduplication: { id: `image-import_${data.recipeId}` },
  });

  // BullMQ answers a deduplicated add with the job already holding the id.
  if (job.id && job.id !== jobId) {
    log.warn(
      { recipeId: data.recipeId, existingJobId: job.id },
      "Duplicate image import job rejected"
    );

    return { status: "duplicate", existingJobId: job.id };
  }

  log.info(
    { jobId: job.id, recipeId: data.recipeId, fileCount: data.files.length },
    "Image import job added to queue"
  );

  return { status: "queued", job };
}
