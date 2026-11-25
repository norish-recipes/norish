import type { Job, JobType } from "bullmq";

import { createLogger } from "@norish/shared-server/logger";

import { ACCOUNT_QUEUES } from "./account-jobs";
import { deleteUnstoredRecipeMedia } from "./import-cleanup";
import { QUEUE_NAMES } from "./queue-names";
import { getQueueByName } from "./registry";

const log = createLogger("queue:account-jobs");

/** Every state but active (a paused queue keeps its jobs in wait): a running job is its worker's. */
const IDLE_STATES: JobType[] = [
  "waiting",
  "prioritized",
  "delayed",
  "waiting-children",
  "completed",
  "failed",
];

type AccountJobData = { userId?: unknown; recipeId?: unknown; recipeIds?: unknown };

/** The recipe ids an import job was given before it ran; a paste may have downloaded their media. */
function importedRecipeIds(name: string, data: AccountJobData): string[] {
  if (name === QUEUE_NAMES.PASTE_IMPORT && Array.isArray(data.recipeIds)) {
    return data.recipeIds.filter((id): id is string => typeof id === "string");
  }
  const imports: string[] = [QUEUE_NAMES.RECIPE_IMPORT, QUEUE_NAMES.IMAGE_IMPORT];

  return imports.includes(name) && typeof data.recipeId === "string" ? [data.recipeId] : [];
}

/** Removes every job of a deleted account, and of its erased recipes, that no worker is running. */
export async function removeAccountJobs(userId: string, recipeIds: string[]): Promise<void> {
  const erased = new Set(recipeIds);
  const belongs = ({ userId: owner, recipeId }: AccountJobData) =>
    owner === userId || (typeof recipeId === "string" && erased.has(recipeId));
  const unstored: string[] = [];

  await Promise.all(
    ACCOUNT_QUEUES.map(async (name) => {
      const queue = getQueueByName(name);
      const jobs = (await queue.getJobs(IDLE_STATES)).filter(
        (job: Job | undefined): job is Job => !!job && belongs(job.data ?? {})
      );

      await Promise.all(
        jobs.map((job) =>
          job
            .remove()
            .then(() => unstored.push(...importedRecipeIds(name, job.data ?? {})))
            .catch((err: unknown) =>
              log.warn({ err, queueName: name, jobId: job.id }, "Could not remove a job")
            )
        )
      );
    })
  );
  await deleteUnstoredRecipeMedia(unstored);
}
