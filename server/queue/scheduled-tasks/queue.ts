/**
 * Scheduled Tasks Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import { Queue } from "bullmq";

import { scheduledTasksJobOptions, QUEUE_NAMES } from "../config";

import { getBullClient } from "@/server/redis/bullmq";

export type ScheduledTaskType =
  | "recurring-grocery-check"
  | "media-cleanup"
  | "calendar-cleanup"
  | "groceries-cleanup"
  | "video-temp-cleanup";

export interface ScheduledTaskJobData {
  taskType: ScheduledTaskType;
}

/**
 * Create a scheduled tasks queue instance.
 * One queue instance per process is expected.
 */
export function createScheduledTasksQueue(): Queue<ScheduledTaskJobData> {
  return new Queue<ScheduledTaskJobData>(QUEUE_NAMES.SCHEDULED_TASKS, {
    connection: getBullClient(),
    defaultJobOptions: scheduledTasksJobOptions,
  });
}
