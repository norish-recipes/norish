/**
 * Scheduled Tasks Producer - Application Logic
 *
 * Enqueue logic for scheduled task jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import type { Queue } from "bullmq";

import { createLogger } from "@norish/shared-server/logger";

import type { ScheduledTaskJobData } from "./queue";
import { SCHEDULED_TASKS } from "./queue";

const log = createLogger("queue:scheduled-tasks");

/** Daily at midnight; every scheduled task runs on the same clock. */
const CRON_MIDNIGHT = "0 0 * * *";

function isKnownTask(data: ScheduledTaskJobData | undefined): boolean {
  return SCHEDULED_TASKS.some((task) => task === data?.taskType);
}

/**
 * What a removed scheduled task leaves behind. Taking its schedule away does
 * not take away the jobs that schedule already put in the queue, so a task
 * type this build no longer knows keeps arriving — and keeps failing, every
 * few seconds, in a Redis nobody thinks to empty. Clear those out here, where
 * the list of tasks that do exist is already in hand.
 */
async function removeStrandedTasks(queue: Queue<ScheduledTaskJobData>): Promise<void> {
  const queued = await queue.getJobs(["waiting", "delayed", "paused", "failed"]);
  const stranded = queued.filter((job) => !isKnownTask(job.data));

  for (const job of stranded) {
    await job.remove().catch((err: unknown) => {
      log.warn({ err, jobId: job.id }, "Could not remove a stranded scheduled task");
    });
  }

  if (stranded.length > 0) {
    log.info(
      {
        count: stranded.length,
        taskTypes: [...new Set(stranded.map((job) => job.data?.taskType))],
      },
      "Removed scheduled tasks this build no longer knows"
    );
  }
}

/**
 * Initialize repeatable jobs for all scheduled tasks.
 * Called once during server startup.
 */
export async function initializeScheduledJobs(queue: Queue<ScheduledTaskJobData>): Promise<void> {
  // Remove any stale repeatable jobs first to ensure clean state
  const existing = await queue.getJobSchedulers();

  for (const job of existing) {
    await queue.removeJobScheduler(job.key);
  }
  await removeStrandedTasks(queue);

  for (const taskType of SCHEDULED_TASKS) {
    await queue.add(
      taskType,
      { taskType },
      { repeat: { pattern: CRON_MIDNIGHT }, jobId: taskType }
    );
  }

  // A new instance should not wait until midnight for its ingredient
  // catalogue. Every boot asks once; the fetch is conditional, so asking about
  // a seed already applied costs one small request.
  await queue.add("ingredient-catalogue-refresh", { taskType: "ingredient-catalogue-refresh" });

  log.info("Repeatable scheduled jobs initialized (daily at midnight)");
}
