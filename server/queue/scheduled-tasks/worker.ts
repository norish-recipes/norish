import { Worker, Job } from "bullmq";

import { redisConnection, QUEUE_NAMES } from "../config";

import { createLogger } from "@/server/logger";
import { checkRecurringGroceries } from "@/server/scheduler/recurring-grocery-check";
import {
  cleanupOrphanedImages,
  cleanupOrphanedAvatars,
  cleanupOrphanedStepImages,
} from "@/server/startup/image-cleanup";
import { cleanupOldCalendarData } from "@/server/scheduler/old-calendar-cleanup";
import { cleanupOldGroceries } from "@/server/scheduler/old-groceries-cleanup";
import { cleanupOldTempFiles } from "@/lib/video/cleanup";

const log = createLogger("worker:scheduled-tasks");

type ScheduledTaskType =
  | "recurring-grocery-check"
  | "image-cleanup"
  | "calendar-cleanup"
  | "groceries-cleanup"
  | "video-temp-cleanup";

interface ScheduledTaskJobData {
  taskType: ScheduledTaskType;
}

let worker: Worker<ScheduledTaskJobData> | null = null;

async function processScheduledTask(job: Job<ScheduledTaskJobData>): Promise<void> {
  const { taskType } = job.data;

  log.info({ jobId: job.id, taskType }, "Processing scheduled task");

  switch (taskType) {
    case "recurring-grocery-check": {
      const result = await checkRecurringGroceries();
      log.info({ unchecked: result.unchecked }, "Recurring grocery check completed");
      break;
    }

    case "image-cleanup": {
      const recipeResult = await cleanupOrphanedImages();
      const avatarResult = await cleanupOrphanedAvatars();
      const stepResult = await cleanupOrphanedStepImages();
      log.info(
        {
          recipesDeleted: recipeResult.deleted,
          avatarsDeleted: avatarResult.deleted,
          stepDirsDeleted: stepResult.deleted,
          errors: recipeResult.errors + avatarResult.errors + stepResult.errors,
        },
        "Image cleanup completed"
      );
      break;
    }

    case "calendar-cleanup": {
      const result = await cleanupOldCalendarData();
      log.info(
        {
          plannedRecipesDeleted: result.plannedRecipesDeleted,
          notesDeleted: result.notesDeleted,
        },
        "Calendar cleanup completed"
      );
      break;
    }

    case "groceries-cleanup": {
      const result = await cleanupOldGroceries();
      log.info({ deleted: result.deleted }, "Groceries cleanup completed");
      break;
    }

    case "video-temp-cleanup": {
      await cleanupOldTempFiles();
      log.info("Video temp cleanup completed");
      break;
    }

    default:
      throw new Error(`Unknown scheduled task type: ${taskType}`);
  }
}

export function startScheduledTasksWorker(): void {
  if (worker) {
    log.warn("Scheduled tasks worker already running");
    return;
  }

  worker = new Worker<ScheduledTaskJobData>(
    QUEUE_NAMES.SCHEDULED_TASKS,
    processScheduledTask,
    {
      connection: redisConnection,
      concurrency: 1, // One task at a time to avoid resource contention.
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id, taskType: job.data.taskType }, "Scheduled task completed");
  });

  worker.on("failed", (job, error) => {
    log.error(
      { jobId: job?.id, taskType: job?.data.taskType, error: error.message },
      "Scheduled task failed"
    );
  });

  worker.on("error", (error) => {
    log.error({ error }, "Scheduled tasks worker error");
  });

  log.info("Scheduled tasks worker started");
}

export async function stopScheduledTasksWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    log.info("Scheduled tasks worker stopped");
  }
}
