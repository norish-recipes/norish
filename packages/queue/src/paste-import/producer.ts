/**
 * Paste Import Producer - Application Logic
 *
 * Enqueue logic for paste import jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import { randomUUID } from "node:crypto";
import type { Queue } from "bullmq";

import type {
  AddPasteImportJobResult,
  PasteImportJobData,
  PasteImportJobResult,
} from "@norish/queue/contracts/job-types";
import { createLogger } from "@norish/shared-server/logger";

const log = createLogger("queue:paste-import");

/**
 * Add a paste import job to the queue. Its batch is BullMQ's deduplication
 * id, freed once the import finishes: an add for a batch whose import is
 * still in flight is answered as a duplicate.
 */
export async function addPasteImportJob(
  queue: Queue<PasteImportJobData, PasteImportJobResult>,
  data: PasteImportJobData
): Promise<AddPasteImportJobResult> {
  const jobId = randomUUID();

  log.debug(
    { batchId: data.batchId, recipeIds: data.recipeIds, jobId, textLength: data.text.length },
    "Adding paste import job"
  );

  const job = await queue.add("paste-import", data, {
    jobId,
    deduplication: { id: `paste-import_${data.batchId}` },
  });

  // BullMQ answers a deduplicated add with the job already holding the id.
  if (job.id && job.id !== jobId) {
    log.warn(
      { batchId: data.batchId, existingJobId: job.id },
      "Duplicate paste import job rejected"
    );

    return { status: "duplicate", existingJobId: job.id };
  }

  log.info({ jobId: job.id, batchId: data.batchId }, "Paste import job added to queue");

  return { status: "queued", job };
}
