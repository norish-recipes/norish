import { Queue } from "bullmq";

import { redisConnection, scheduledTasksJobOptions, QUEUE_NAMES } from "../config";

import { createLogger } from "@/server/logger";

const log = createLogger("queue:scheduled-tasks");

export type ScheduledTaskType =
  | "recurring-grocery-check"
  | "image-cleanup"
  | "calendar-cleanup"
  | "groceries-cleanup"
  | "video-temp-cleanup";

export interface ScheduledTaskJobData {
  taskType: ScheduledTaskType;
}

export const scheduledTasksQueue = new Queue<ScheduledTaskJobData>(QUEUE_NAMES.SCHEDULED_TASKS, {
  connection: redisConnection,
  defaultJobOptions: scheduledTasksJobOptions,
});

/**
 * Initialize repeatable jobs for all scheduled tasks.
 * Called once during server startup.
 */
export async function initializeScheduledJobs(): Promise<void> {
  // Remove any stale repeatable jobs first to ensure clean state
  const existing = await scheduledTasksQueue.getJobSchedulers();
  for (const job of existing) {
    await scheduledTasksQueue.removeJobScheduler(job.key);
  }

  const cronMidnight = "0 0 * * *"; // Daily at midnight

  await scheduledTasksQueue.add(
    "recurring-grocery-check",
    { taskType: "recurring-grocery-check" },
    { repeat: { pattern: cronMidnight }, jobId: "recurring-grocery-check" }
  );

  await scheduledTasksQueue.add(
    "image-cleanup",
    { taskType: "image-cleanup" },
    { repeat: { pattern: cronMidnight }, jobId: "image-cleanup" }
  );

  await scheduledTasksQueue.add(
    "calendar-cleanup",
    { taskType: "calendar-cleanup" },
    { repeat: { pattern: cronMidnight }, jobId: "calendar-cleanup" }
  );

  await scheduledTasksQueue.add(
    "groceries-cleanup",
    { taskType: "groceries-cleanup" },
    { repeat: { pattern: cronMidnight }, jobId: "groceries-cleanup" }
  );

  await scheduledTasksQueue.add(
    "video-temp-cleanup",
    { taskType: "video-temp-cleanup" },
    { repeat: { pattern: cronMidnight }, jobId: "video-temp-cleanup" }
  );

  log.info("Repeatable scheduled jobs initialized (daily at midnight)");
}

/**
 * Close the queue connection gracefully.
 * Call during server shutdown.
 */
export async function closeScheduledTasksQueue(): Promise<void> {
  await scheduledTasksQueue.close();
  log.info("Scheduled tasks queue closed");
}
