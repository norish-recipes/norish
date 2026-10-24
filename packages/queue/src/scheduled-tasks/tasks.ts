/**
 * Scheduled Tasks - the tasks and their job data. Their queue is built by the
 * registry like every other.
 */

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
  "ingredient-catalogue-refresh",
  "ingredient-sweep",
] as const;

export type ScheduledTaskType = (typeof SCHEDULED_TASKS)[number];

export interface ScheduledTaskJobData {
  taskType: ScheduledTaskType;
}
