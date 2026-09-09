/**
 * Scheduled Tasks Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import { Queue } from "bullmq";

import { getBullClient } from "@norish/queue/redis/bullmq";

import type { QueueRemovalOptions } from "../config";
import { QUEUE_NAMES, scheduledTasksJobOptions } from "../config";

/**
 * Every scheduled task this build knows, and the one place that says so. The
 * producer registers exactly these and clears out anything else it finds
 * queued, so a task removed from the code cannot keep arriving.
 */
export const SCHEDULED_TASKS = [
  "recurring-grocery-check",
  "media-cleanup",
  "calendar-cleanup",
  "groceries-cleanup",
  "video-temp-cleanup",
] as const;

export type ScheduledTaskType = (typeof SCHEDULED_TASKS)[number];

export interface ScheduledTaskJobData {
  taskType: ScheduledTaskType;
}

/**
 * Create a scheduled tasks queue instance.
 * One queue instance per process is expected.
 */
export function createScheduledTasksQueue(
  removalOptions?: QueueRemovalOptions
): Queue<ScheduledTaskJobData> {
  return new Queue<ScheduledTaskJobData>(QUEUE_NAMES.SCHEDULED_TASKS, {
    connection: getBullClient(),
    defaultJobOptions: { ...scheduledTasksJobOptions, ...removalOptions },
  });
}
