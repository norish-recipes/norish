import type { PasteImportJobData, AddPasteImportJobResult } from "@/types";

import { Queue } from "bullmq";

import { redisConnection, QUEUE_NAMES } from "../config";
import { isJobInQueue } from "../helpers";

import { createLogger } from "@/server/logger";

const log = createLogger("queue:paste-import");

const pasteImportJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
  removeOnComplete: true,
  removeOnFail: true,
};

export const pasteImportQueue = new Queue<PasteImportJobData>(QUEUE_NAMES.PASTE_IMPORT, {
  connection: redisConnection,
  defaultJobOptions: pasteImportJobOptions,
});

function generatePasteJobId(recipeId: string): string {
  return `paste-import_${recipeId}`;
}

export async function addPasteImportJob(
  data: PasteImportJobData
): Promise<AddPasteImportJobResult> {
  const jobId = generatePasteJobId(data.recipeId);

  log.debug(
    { recipeId: data.recipeId, jobId, textLength: data.text.length },
    "Adding paste import job"
  );

  if (await isJobInQueue(pasteImportQueue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate paste import job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await pasteImportQueue.add("paste-import", data, { jobId });

  log.info({ jobId: job.id, recipeId: data.recipeId }, "Paste import job added to queue");

  return { status: "queued", job };
}

export async function closePasteImportQueue(): Promise<void> {
  await pasteImportQueue.close();
  log.info("Paste import queue closed");
}
