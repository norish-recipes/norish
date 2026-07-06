import type { Job } from "bullmq";
import { Worker } from "bullmq";

import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { cleanupOldCalendarData } from "@norish/queue/scheduler/old-calendar-cleanup";
import { cleanupOldGroceries } from "@norish/queue/scheduler/old-groceries-cleanup";
import { checkRecurringGroceries } from "@norish/queue/scheduler/recurring-grocery-check";
import { createLogger } from "@norish/shared-server/logger";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";

const log = createLogger("worker:scheduled-tasks");

type ScheduledTaskType =
  | "recurring-grocery-check"
  | "media-cleanup"
  | "calendar-cleanup"
  | "groceries-cleanup"
  | "video-temp-cleanup";

interface ScheduledTaskJobData {
  taskType: ScheduledTaskType;
}

// Use globalThis to survive HMR in development
const globalForWorker = globalThis as unknown as {
  scheduledTasksWorker: Worker<ScheduledTaskJobData> | null;
};

let worker: Worker<ScheduledTaskJobData> | null = globalForWorker.scheduledTasksWorker ?? null;

async function processScheduledTask(job: Job<ScheduledTaskJobData>): Promise<void> {
  const cleanupOrphanedImages = requireQueueApiHandler("cleanupOrphanedImages");
  const cleanupOrphanedAvatars = requireQueueApiHandler("cleanupOrphanedAvatars");
  const cleanupOrphanedStepImages = requireQueueApiHandler("cleanupOrphanedStepImages");
  const cleanupOldTempFiles = requireQueueApiHandler("cleanupOldTempFiles");
  const { taskType } = job.data;

  log.info({ jobId: job.id, taskType }, "Processing scheduled task");

  switch (taskType) {
    case "recurring-grocery-check": {
      const result = await checkRecurringGroceries();

      log.info({ unchecked: result.unchecked }, "Recurring grocery check completed");
      break;
    }

    case "media-cleanup": {
      const recipeResult = await cleanupOrphanedImages();
      const avatarResult = await cleanupOrphanedAvatars();
      const stepResult = await cleanupOrphanedStepImages();

      log.info(
        {
          mediaDeleted: recipeResult.deleted,
          avatarsDeleted: avatarResult.deleted,
          stepImagesDeleted: stepResult.deleted,
          errors: recipeResult.errors + avatarResult.errors + stepResult.errors,
        },
        "Media cleanup completed"
      );
      break;
    }

    case "calendar-cleanup": {
      const result = await cleanupOldCalendarData();

      log.info(
        {
          plannedItemsDeleted: result.plannedItemsDeleted,
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

  worker = new Worker<ScheduledTaskJobData>(QUEUE_NAMES.SCHEDULED_TASKS, processScheduledTask, {
    connection: getBullClient(),
    ...baseWorkerOptions,
    stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.SCHEDULED_TASKS],
    concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.SCHEDULED_TASKS],
  });

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
    log.error({ err: error }, "Scheduled tasks worker error");
  });

  globalForWorker.scheduledTasksWorker = worker;
  log.info("Scheduled tasks worker started");
}

export async function stopScheduledTasksWorker(): Promise<void> {
  if (worker) {
    worker.removeAllListeners();
    await worker.close();
    worker = null;
    globalForWorker.scheduledTasksWorker = null;
    log.info("Scheduled tasks worker stopped");
  }
}
