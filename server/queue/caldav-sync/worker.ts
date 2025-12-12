import type { CaldavSyncJobData } from "@/types";
import type { CaldavSyncStatusInsertDto } from "@/types/dto/caldav-sync-status";
import type { Slot } from "@/types";

import { Worker, Job } from "bullmq";

import { redisConnection, QUEUE_NAMES } from "../config";

import { createLogger } from "@/server/logger";
import {
  syncPlannedItem,
  deletePlannedItem,
  truncateErrorMessage,
} from "@/server/caldav/sync-manager";
import {
  createCaldavSyncStatus,
  updateCaldavSyncStatus,
  getCaldavSyncStatusByItemId,
} from "@/server/db/repositories/caldav-sync-status";
import { caldavEmitter } from "@/server/trpc/routers/caldav/emitter";

const log = createLogger("worker:caldav-sync");

let worker: Worker<CaldavSyncJobData> | null = null;

/**
 * Process a single CalDAV sync job.
 */
async function processCaldavSyncJob(job: Job<CaldavSyncJobData>): Promise<void> {
  const { userId, itemId, itemType, plannedItemId, eventTitle, operation } = job.data;

  log.info(
    { jobId: job.id, userId, itemId, operation, attempt: job.attemptsMade + 1 },
    "Processing CalDAV sync job"
  );

  // Emit pending status on retry attempts
  if (job.attemptsMade > 0) {
    caldavEmitter.emitToUser(userId, "itemStatusUpdated", {
      itemId,
      itemType,
      syncStatus: "pending",
      errorMessage: null,
      caldavEventUid: null,
    });
  }

  if (operation === "delete") {
    await deletePlannedItem(userId, itemId);
    return;
  }

  // operation === "sync" handles both create and update
  const { date, slot, recipeId } = job.data;

  // Check if sync status record exists
  const existingStatus = await getCaldavSyncStatusByItemId(userId, itemId);
  const isNewRecord = !existingStatus;

  // Perform the CalDAV sync (throws on error)
  const { uid } = await syncPlannedItem(
    userId,
    itemId,
    eventTitle,
    date,
    slot as Slot,
    recipeId
  );

  if (isNewRecord) {
    const insertData: CaldavSyncStatusInsertDto = {
      userId,
      itemId,
      itemType,
      plannedItemId,
      eventTitle,
      syncStatus: "synced",
      caldavEventUid: uid,
      retryCount: job.attemptsMade,
      errorMessage: null,
      lastSyncAt: new Date(),
    };

    await createCaldavSyncStatus(insertData);
  } else {
    await updateCaldavSyncStatus(existingStatus.id, {
      eventTitle,
      syncStatus: "synced",
      caldavEventUid: uid,
      retryCount: job.attemptsMade,
      errorMessage: null,
      lastSyncAt: new Date(),
    });
  }

  // Emit success events
  caldavEmitter.emitToUser(userId, "itemStatusUpdated", {
    itemId,
    itemType,
    syncStatus: "synced",
    errorMessage: null,
    caldavEventUid: uid,
  });

  caldavEmitter.emitToUser(userId, "syncCompleted", {
    itemId,
    caldavEventUid: uid,
  });
}

async function handleJobFailed(
  job: Job<CaldavSyncJobData> | undefined,
  error: Error
): Promise<void> {
  if (!job) return;

  const { userId, itemId, itemType, plannedItemId, eventTitle } = job.data;
  const maxAttempts = job.opts.attempts ?? 10;
  const isFinalFailure = job.attemptsMade >= maxAttempts;

  const errorMessage = truncateErrorMessage(error.message);

  log.error(
    {
      jobId: job.id,
      userId,
      itemId,
      attempt: job.attemptsMade,
      maxAttempts,
      isFinalFailure,
      error: error.message,
    },
    "CalDAV sync job failed"
  );

  // Update database with failure status
  const existingStatus = await getCaldavSyncStatusByItemId(userId, itemId);

  if (!existingStatus) {
    const insertData: CaldavSyncStatusInsertDto = {
      userId,
      itemId,
      itemType,
      plannedItemId,
      eventTitle,
      syncStatus: "failed",
      caldavEventUid: null,
      retryCount: job.attemptsMade,
      errorMessage,
      lastSyncAt: new Date(),
    };

    await createCaldavSyncStatus(insertData);
  } else {
    await updateCaldavSyncStatus(existingStatus.id, {
      eventTitle,
      syncStatus: isFinalFailure ? "failed" : "pending",
      retryCount: job.attemptsMade,
      errorMessage,
      lastSyncAt: new Date(),
    });
  }

  // Emit failure events
  caldavEmitter.emitToUser(userId, "itemStatusUpdated", {
    itemId,
    itemType,
    syncStatus: isFinalFailure ? "failed" : "pending",
    errorMessage,
    caldavEventUid: null,
  });

  if (isFinalFailure) {
    caldavEmitter.emitToUser(userId, "syncFailed", {
      itemId,
      errorMessage,
      retryCount: job.attemptsMade,
    });
  }
}

/**
 * Start the CalDAV sync worker.
 * Call during server startup.
 */
export function startCaldavSyncWorker(): void {
  if (worker) {
    log.warn("CalDAV sync worker already running");
    return;
  }

  worker = new Worker<CaldavSyncJobData>(
    QUEUE_NAMES.CALDAV_SYNC,
    processCaldavSyncJob,
    {
      connection: redisConnection,
      concurrency: 3, // Limit concurrent CalDAV operations
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "CalDAV sync job completed");
  });

  worker.on("failed", (job, error) => {
    handleJobFailed(job, error);
  });

  worker.on("error", (error) => {
    log.error({ error }, "CalDAV sync worker error");
  });

  log.info("CalDAV sync worker started");
}

/**
 * Stop the CalDAV sync worker.
 * Call during server shutdown.
 */
export async function stopCaldavSyncWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    log.info("CalDAV sync worker stopped");
  }
}

