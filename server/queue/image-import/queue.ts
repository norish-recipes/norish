import type { ImageImportJobData, AddImageImportJobResult } from "@/types";

import { Queue } from "bullmq";

import { QUEUE_NAMES, imageImportJobOptions } from "../config";
import { isJobInQueue } from "../helpers";

import { getBullClient } from "@/server/redis/bullmq";
import { createLogger } from "@/server/logger";

const log = createLogger("queue:image-import");

/**
 * Image import queue instance
 */
export const imageImportQueue = new Queue<ImageImportJobData>(QUEUE_NAMES.IMAGE_IMPORT, {
  connection: getBullClient(),
  defaultJobOptions: imageImportJobOptions,
});

/**
 * Generate a unique job ID for image imports.
 * Uses recipeId since we don't have a URL to dedupe by.
 */
function generateImageJobId(recipeId: string): string {
  return `image-import_${recipeId}`;
}

/**
 * Add an image import job to the queue.
 * Returns conflict status if a duplicate job already exists.
 */
export async function addImageImportJob(
  data: ImageImportJobData
): Promise<AddImageImportJobResult> {
  const jobId = generateImageJobId(data.recipeId);

  log.debug(
    { recipeId: data.recipeId, jobId, fileCount: data.files.length },
    "Adding image import job"
  );

  if (await isJobInQueue(imageImportQueue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate image import job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await imageImportQueue.add("image-import", data, { jobId });

  log.info(
    { jobId: job.id, recipeId: data.recipeId, fileCount: data.files.length },
    "Image import job added to queue"
  );

  return { status: "queued", job };
}

/**
 * Close the queue connection gracefully.
 */
export async function closeImageImportQueue(): Promise<void> {
  await imageImportQueue.close();
  log.info("Image import queue closed");
}
