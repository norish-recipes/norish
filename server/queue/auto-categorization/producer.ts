import type { Queue } from "bullmq";
import type { AutoCategorizationJobData, AddAutoCategorizationJobResult } from "@/types";

import { isJobInQueue } from "../helpers";

import { createLogger } from "@/server/logger";
import { isAIEnabled } from "@/config/server-config-loader";

const log = createLogger("queue:auto-categorization");

export async function addAutoCategorizationJob(
  queue: Queue<AutoCategorizationJobData>,
  data: AutoCategorizationJobData
): Promise<AddAutoCategorizationJobResult> {
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    return { status: "skipped", reason: "disabled" };
  }

  const jobId = `auto-categorize-${data.recipeId}`;

  log.debug({ recipeId: data.recipeId, jobId }, "Attempting to add auto-categorization job");

  if (await isJobInQueue(queue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate auto-categorization job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await queue.add("auto-categorize", data, { jobId });

  log.info({ recipeId: data.recipeId, jobId: job.id }, "Auto-categorization job added to queue");

  return { status: "queued", job };
}

export async function isAutoCategorizationJobActive(
  queue: Queue<AutoCategorizationJobData>,
  recipeId: string
): Promise<boolean> {
  const jobId = `auto-categorize-${recipeId}`;

  return isJobInQueue(queue, jobId);
}
