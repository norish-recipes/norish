/**
 * Scheduled Tasks Producer - Application Logic
 *
 * Enqueue logic for scheduled task jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import type { Queue } from "bullmq";
import type { ScheduledTaskJobData } from "./queue";

import { createLogger } from "@/server/logger";

const log = createLogger("queue:scheduled-tasks");

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

  const cronMidnight = "0 0 * * *"; // Daily at midnight

  await queue.add(
    "recurring-grocery-check",
    { taskType: "recurring-grocery-check" },
    { repeat: { pattern: cronMidnight }, jobId: "recurring-grocery-check" }
  );

  await queue.add(
    "media-cleanup",
    { taskType: "media-cleanup" },
    { repeat: { pattern: cronMidnight }, jobId: "media-cleanup" }
  );

  await queue.add(
    "calendar-cleanup",
    { taskType: "calendar-cleanup" },
    { repeat: { pattern: cronMidnight }, jobId: "calendar-cleanup" }
  );

  await queue.add(
    "groceries-cleanup",
    { taskType: "groceries-cleanup" },
    { repeat: { pattern: cronMidnight }, jobId: "groceries-cleanup" }
  );

  await queue.add(
    "video-temp-cleanup",
    { taskType: "video-temp-cleanup" },
    { repeat: { pattern: cronMidnight }, jobId: "video-temp-cleanup" }
  );

  log.info("Repeatable scheduled jobs initialized (daily at midnight)");
}
