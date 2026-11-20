import type { Job } from "bullmq";

import type { CaldavSyncJobData } from "@norish/queue/contracts/job-types";
import type { Slot } from "@norish/shared/contracts";
import type { CaldavSyncStatusInsertDto } from "@norish/shared/contracts/dto/caldav-sync-status";
import type { CaldavSyncEventData } from "@norish/shared/contracts/realtime/caldav";
import {
  createCaldavSyncStatus,
  getCaldavSyncStatusByItemId,
  updateCaldavSyncStatus,
} from "@norish/db/repositories/caldav-sync-status";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { createLogger } from "@norish/shared-server/logger";
import { caldav } from "@norish/shared-server/realtime/caldav";

import { createWorker, isFinalFailure } from "../create-worker";
import { reportStep } from "../job-steps";
import { QUEUE_NAMES } from "../queue-names";

const log = createLogger("worker:caldav-sync");

type CaldavItemStatusUpdatedPayload = CaldavSyncEventData["itemStatusUpdated"];

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

    void caldav.publish("syncEvent", { type: "itemStatusUpdated", data: payload }, { userId });
  }

  if (operation === "delete") {
    await reportStep(job, "deleting-event");
    await deletePlannedItem(userId, itemId);

    return;
  }

  // operation === "sync" handles both create and update
  const { date, slot, recipeId } = job.data;

  // Check if sync status record exists
  const isNewRecord = !existingStatus;

  // Perform the CalDAV sync (throws on error)
  await reportStep(job, "syncing-event");
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

  void caldav.publish("syncEvent", { type: "itemStatusUpdated", data: successPayload }, { userId });

  void caldav.publish(
    "syncEvent",
    {
      type: "syncCompleted",
      data: {
        itemId,
        caldavEventUid: uid,
      },
    },
    { userId }
  );
}

async function handleJobFailed(
  job: Job<CaldavSyncJobData> | undefined,
  error: Error
): Promise<void> {
  const truncateErrorMessage = requireQueueApiHandler("truncateErrorMessage");

  if (!job) return;

  const { userId, itemId, itemType, plannedItemId, eventTitle } = job.data;
  const isFinal = isFinalFailure(job, error);

  const errorMessage = truncateErrorMessage(error.message);

  // Update database with failure status
  const existingStatus = await getCaldavSyncStatusByItemId(userId, itemId);

  const persistedStatus = !existingStatus
    ? await createCaldavSyncStatus({
        userId,
        itemId,
        itemType,
        plannedItemId,
        eventTitle,
        syncStatus: isFinal ? "failed" : "pending",
        caldavEventUid: null,
        retryCount: job.attemptsMade,
        errorMessage,
        lastSyncAt: new Date(),
      } satisfies CaldavSyncStatusInsertDto)
    : await updateCaldavSyncStatus(existingStatus.id, {
        eventTitle,
        syncStatus: isFinal ? "failed" : "pending",
        retryCount: job.attemptsMade,
        errorMessage,
        lastSyncAt: new Date(),
      });

  // Emit failure events
  const failurePayload = {
    itemId,
    itemType,
    syncStatus: isFinal ? "failed" : "pending",
    errorMessage,
    caldavEventUid: null,
    version: persistedStatus.version,
  } as CaldavItemStatusUpdatedPayload;

  void caldav.publish("syncEvent", { type: "itemStatusUpdated", data: failurePayload }, { userId });

  if (isFinal) {
    void caldav.publish(
      "syncEvent",
      {
        type: "syncFailed",
        data: {
          itemId,
          errorMessage,
          retryCount: job.attemptsMade,
        },
      },
      { userId }
    );
  }
}

export function startCaldavSyncWorker(): void {
  createWorker(QUEUE_NAMES.CALDAV_SYNC, processCaldavSyncJob, { onFailed: handleJobFailed });
}
