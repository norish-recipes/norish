import type { CaldavSyncJobData } from "@/types";
import type { CaldavSyncStatusInsertDto } from "@/types/dto/caldav-sync-status";
import type { Slot } from "@/types";
import type { Job } from "bullmq";

import { QUEUE_NAMES, baseWorkerOptions, WORKER_CONCURRENCY, STALLED_INTERVAL } from "../config";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

import { getBullClient } from "@/server/redis/bullmq";
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
  const { uid } = await syncPlannedItem(userId, itemId, eventTitle, date, slot as Slot, recipeId);

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
 * Start the CalDAV sync worker (lazy - starts on demand).
 * Call during server startup.
 */
export async function startCaldavSyncWorker(): Promise<void> {
  await createLazyWorker<CaldavSyncJobData>(
    QUEUE_NAMES.CALDAV_SYNC,
    processCaldavSyncJob,
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.CALDAV_SYNC],
      concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.CALDAV_SYNC],
    },
    handleJobFailed
  );
}

/**
 * Stop the CalDAV sync worker.
 * Call during server shutdown.
 */
export async function stopCaldavSyncWorker(): Promise<void> {
  await stopLazyWorker(QUEUE_NAMES.CALDAV_SYNC);
}
