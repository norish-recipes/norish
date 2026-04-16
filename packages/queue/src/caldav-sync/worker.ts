import type { Job } from "bullmq";

import type { CaldavSyncJobData } from "@norish/queue/contracts/job-types";
import type { Slot } from "@norish/shared/contracts";
import type { CaldavSyncStatusInsertDto } from "@norish/shared/contracts/dto/caldav-sync-status";
import type { CaldavSubscriptionEvents } from "@norish/trpc";
import {
  createCaldavSyncStatus,
  getCaldavSyncStatusByItemId,
  updateCaldavSyncStatus,
} from "@norish/db/repositories/caldav-sync-status";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { createLogger } from "@norish/shared-server/logger";
import { caldavEmitter } from "@norish/trpc/routers/caldav/emitter";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";
import { createLazyWorker, stopLazyWorker } from "../lazy-worker-manager";

const log = createLogger("worker:caldav-sync");

type CaldavItemStatusUpdatedPayload = CaldavSubscriptionEvents["itemStatusUpdated"] & {
  version: number;
};

/**
 * Process a single CalDAV sync job.
 */
async function processCaldavSyncJob(job: Job<CaldavSyncJobData>): Promise<void> {
  const deletePlannedItem = requireQueueApiHandler("deletePlannedItem");
  const syncPlannedItem = requireQueueApiHandler("syncPlannedItem");
  const { userId, itemId, itemType, plannedItemId, eventTitle, operation } = job.data;

  log.info(
    { jobId: job.id, userId, itemId, operation, attempt: job.attemptsMade + 1 },
    "Processing CalDAV sync job"
  );

  const existingStatus = await getCaldavSyncStatusByItemId(userId, itemId);

  // Emit pending status on retry attempts
  if (job.attemptsMade > 0 && existingStatus) {
    const payload = {
      itemId,
      itemType,
      syncStatus: "pending",
      errorMessage: null,
      caldavEventUid: null,
      version: existingStatus.version,
    } as CaldavItemStatusUpdatedPayload;

    caldavEmitter.emitToUser(userId, "itemStatusUpdated", payload);
  }

  if (operation === "delete") {
    await deletePlannedItem(userId, itemId);

    return;
  }

  // operation === "sync" handles both create and update
  const { date, slot, recipeId } = job.data;

  // Check if sync status record exists
  const isNewRecord = !existingStatus;

  // Perform the CalDAV sync (throws on error)
  const { uid } = await syncPlannedItem(userId, itemId, eventTitle, date, slot as Slot, recipeId);

  const persistedStatus = isNewRecord
    ? await createCaldavSyncStatus({
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
      })
    : await updateCaldavSyncStatus(existingStatus.id, {
        eventTitle,
        syncStatus: "synced",
        caldavEventUid: uid,
        retryCount: job.attemptsMade,
        errorMessage: null,
        lastSyncAt: new Date(),
      });

  // Emit success events
  const successPayload = {
    itemId,
    itemType,
    syncStatus: "synced",
    errorMessage: null,
    caldavEventUid: uid,
    version: persistedStatus.version,
  } as CaldavItemStatusUpdatedPayload;

  caldavEmitter.emitToUser(userId, "itemStatusUpdated", successPayload);

  caldavEmitter.emitToUser(userId, "syncCompleted", {
    itemId,
    caldavEventUid: uid,
  });
}

async function handleJobFailed(
  job: Job<CaldavSyncJobData> | undefined,
  error: Error
): Promise<void> {
  const truncateErrorMessage = requireQueueApiHandler("truncateErrorMessage");

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

  const persistedStatus = !existingStatus
    ? await createCaldavSyncStatus({
        userId,
        itemId,
        itemType,
        plannedItemId,
        eventTitle,
        syncStatus: isFinalFailure ? "failed" : "pending",
        caldavEventUid: null,
        retryCount: job.attemptsMade,
        errorMessage,
        lastSyncAt: new Date(),
      } satisfies CaldavSyncStatusInsertDto)
    : await updateCaldavSyncStatus(existingStatus.id, {
        eventTitle,
        syncStatus: isFinalFailure ? "failed" : "pending",
        retryCount: job.attemptsMade,
        errorMessage,
        lastSyncAt: new Date(),
      });

  // Emit failure events
  const failurePayload = {
    itemId,
    itemType,
    syncStatus: isFinalFailure ? "failed" : "pending",
    errorMessage,
    caldavEventUid: null,
    version: persistedStatus.version,
  } as CaldavItemStatusUpdatedPayload;

  caldavEmitter.emitToUser(userId, "itemStatusUpdated", failurePayload);

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
