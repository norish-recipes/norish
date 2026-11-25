import type { Job, JobType } from "bullmq";

import { createLogger } from "@norish/shared-server/logger";

import { ACCOUNT_QUEUES } from "./account-jobs";
import { getQueueByName } from "./registry";

const log = createLogger("queue:account-jobs");

/** Every state but active: a running job is its worker's until it settles. */
const IDLE_STATES: JobType[] = [
  "waiting",
  "prioritized",
  "delayed",
  "waiting-children",
  "completed",
  "failed",
];

/** Removes every job of a deleted account, and of its erased recipes, that no worker is running. */
export async function removeAccountJobs(userId: string, recipeIds: string[]): Promise<void> {
  const erased = new Set(recipeIds);
  const ofAccount = ({ data }: Job) => {
    const { userId: owner, recipeId } = (data ?? {}) as { userId?: unknown; recipeId?: unknown };

    return owner === userId || (typeof recipeId === "string" && erased.has(recipeId));
  };

  await Promise.all(
    ACCOUNT_QUEUES.map(async (name) => {
      const jobs = await getQueueByName(name).getJobs(IDLE_STATES);

      await Promise.all(
        jobs
          .filter((job) => job && ofAccount(job))
          .map((job) =>
            job
              .remove()
              .catch((err: unknown) =>
                log.warn({ err, queueName: name, jobId: job.id }, "Could not remove a job")
              )
          )
      );
    })
  );
}
