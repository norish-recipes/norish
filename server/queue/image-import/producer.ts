/**
 * Image Import Producer - Application Logic
 *
 * Enqueue logic for image import jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import type { Queue } from "bullmq";
import type { ImageImportJobData, AddImageImportJobResult } from "@/types";

import { isJobInQueue } from "../helpers";

import { createLogger } from "@/server/logger";

const log = createLogger("queue:image-import");

function generateImageJobId(recipeId: string): string {
  return `image-import_${recipeId}`;
}

/**
 * Add an image import job to the queue.
 * Returns conflict status if a duplicate job already exists.
 */
export async function addImageImportJob(
  queue: Queue<ImageImportJobData>,
  data: ImageImportJobData
): Promise<AddImageImportJobResult> {
  const jobId = generateImageJobId(data.recipeId);

  log.debug(
    { recipeId: data.recipeId, jobId, fileCount: data.files.length },
    "Adding image import job"
  );

  if (await isJobInQueue(queue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate image import job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await queue.add("image-import", data, { jobId });

  log.info(
    { jobId: job.id, recipeId: data.recipeId, fileCount: data.files.length },
    "Image import job added to queue"
  );

  return { status: "queued", job };
}
