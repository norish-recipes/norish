/**
 * Paste Import Producer - Application Logic
 *
 * Enqueue logic for paste import jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import type { Queue } from "bullmq";

import type {
  AddPasteImportJobResult,
  PasteImportJobData,
  PasteImportJobResult,
} from "@norish/queue/contracts/job-types";
import { createLogger } from "@norish/shared-server/logger";

import { isJobInQueue } from "../helpers";

const log = createLogger("queue:paste-import");

function generatePasteJobId(batchId: string): string {
  return `paste-import_${batchId}`;
}

/**
 * Add a paste import job to the queue.
 * Returns conflict status if a duplicate job already exists.
 */
export async function addPasteImportJob(
  queue: Queue<PasteImportJobData, PasteImportJobResult>,
  data: PasteImportJobData
): Promise<AddPasteImportJobResult> {
  const jobId = generatePasteJobId(data.batchId);

  log.debug(
    { batchId: data.batchId, recipeIds: data.recipeIds, jobId, textLength: data.text.length },
    "Adding paste import job"
  );

  if (await isJobInQueue(queue, jobId)) {
    log.warn({ batchId: data.batchId, jobId }, "Duplicate paste import job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await queue.add("paste-import", data, { jobId });

  log.info({ jobId: job.id, batchId: data.batchId }, "Paste import job added to queue");

  return { status: "queued", job };
}
