/**
 * Paste Import Producer - Application Logic
 *
 * Enqueue logic for paste import jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import type { Queue } from "bullmq";
import type { PasteImportJobData, AddPasteImportJobResult } from "@/types";

import { isJobInQueue } from "../helpers";

import { createLogger } from "@/server/logger";

const log = createLogger("queue:paste-import");

function generatePasteJobId(recipeId: string): string {
  return `paste-import_${recipeId}`;
}

/**
 * Add a paste import job to the queue.
 * Returns conflict status if a duplicate job already exists.
 */
export async function addPasteImportJob(
  queue: Queue<PasteImportJobData>,
  data: PasteImportJobData
): Promise<AddPasteImportJobResult> {
  const jobId = generatePasteJobId(data.recipeId);

  log.debug(
    { recipeId: data.recipeId, jobId, textLength: data.text.length },
    "Adding paste import job"
  );

  if (await isJobInQueue(queue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate paste import job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await queue.add("paste-import", data, { jobId });

  log.info({ jobId: job.id, recipeId: data.recipeId }, "Paste import job added to queue");

  return { status: "queued", job };
}
