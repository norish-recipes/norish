"use client";

import type { CaldavSyncStatus, CaldavSyncStatusViewDto } from "@/types";
import type { CaldavSubscriptionEvents } from "@/server/trpc/routers/caldav/types";

import { useSubscription } from "@trpc/tanstack-react-query";
import { addToast } from "@heroui/react";

import { useCaldavCacheHelpers } from "./use-caldav-cache";

import { createClientLogger } from "@/lib/logger";
import { useTRPC } from "@/app/providers/trpc-provider";

const log = createClientLogger("CaldavSubscription");

type SyncEventPayload = {
  type: keyof CaldavSubscriptionEvents;
  data: CaldavSubscriptionEvents[keyof CaldavSubscriptionEvents];
};

/**
 * Hook that subscribes to all CalDAV-related WebSocket events.
 *
 * Uses internal cache helpers - no props required.
 * Safe to call from context providers without causing recursion.
 */
export function useCaldavSubscription() {
  const trpc = useTRPC();
  const { setConfig, setStatuses, invalidateSyncStatus, invalidateSummary } =
    useCaldavCacheHelpers();

  // Subscribe to all CalDAV sync events
  useSubscription(
    trpc.caldavSubscriptions.onSyncEvent.subscriptionOptions(undefined, {
      onData: (event: SyncEventPayload) => {
        const { type, data } = event;

        if (type === "configSaved") {
          const payload = data as CaldavSubscriptionEvents["configSaved"];

          setConfig(() => payload.config);
        } else if (type === "syncStarted") {
          // Optionally show a toast or update UI state
        } else if (type === "syncCompleted") {
          // Individual item synced - update status in cache
          invalidateSyncStatus();
          invalidateSummary();
        } else if (type === "syncFailed") {
          // Individual item failed - update status in cache
          invalidateSyncStatus();
          invalidateSummary();
        } else if (type === "itemStatusUpdated") {
          const payload = data as CaldavSubscriptionEvents["itemStatusUpdated"];

          // Update specific item in cache
          setStatuses((prev) => {
            if (!prev) return prev;

            const { itemId, itemType, syncStatus, errorMessage, caldavEventUid } = payload;

            const updatedStatuses = prev.statuses.map((status) => {
              if (status.itemId === itemId && status.itemType === itemType) {
                return {
                  ...status,
                  syncStatus: syncStatus as CaldavSyncStatus,
                  errorMessage,
                  caldavEventUid,
                  lastSyncAt: new Date(),
                } satisfies CaldavSyncStatusViewDto;
              }

              return status;
            });

            return { ...prev, statuses: updatedStatuses };
          });
          invalidateSummary();
        } else if (type === "initialSyncComplete") {
          const payload = data as CaldavSubscriptionEvents["initialSyncComplete"];

          // Full sync completed - refresh all data
          addToast({
            title: "CalDAV Sync Complete",
            description: `Synced ${payload.totalSynced} items${payload.totalFailed > 0 ? `, ${payload.totalFailed} failed` : ""}`,
            color: payload.totalFailed > 0 ? "warning" : "success",
            shouldShowTimeoutProgress: true,
            radius: "full",
          });
          invalidateSyncStatus();
          invalidateSummary();
        }
      },
      onError: (error) => {
        log.error({ err: error }, "CalDAV subscription error");
      },
    })
  );
}

/**
 * Hook that subscribes only to item status updates.
 * More efficient if you only need status updates for the sync table.
 *
 * Uses internal cache helpers - no props required.
 */
export function useCaldavItemStatusSubscription() {
  const trpc = useTRPC();
  const { setStatuses, invalidateSummary } = useCaldavCacheHelpers();

  useSubscription(
    trpc.caldavSubscriptions.onItemStatusUpdated.subscriptionOptions(undefined, {
      onData: (data) => {
        const { itemId, itemType, syncStatus, errorMessage, caldavEventUid } = data;

        setStatuses((prev) => {
          if (!prev) return prev;

          const updatedStatuses = prev.statuses.map((status) => {
            if (status.itemId === itemId && status.itemType === itemType) {
              return {
                ...status,
                syncStatus: syncStatus as CaldavSyncStatus,
                errorMessage,
                caldavEventUid,
                lastSyncAt: new Date(),
              } satisfies CaldavSyncStatusViewDto;
            }

            return status;
          });

          return { ...prev, statuses: updatedStatuses };
        });

        invalidateSummary();
      },
    })
  );
}

/**
 * Hook that subscribes to sync completion events.
 *
 * Uses internal cache helpers - no props required.
 */
export function useCaldavSyncCompleteSubscription() {
  const trpc = useTRPC();
  const { invalidateSyncStatus, invalidateSummary } = useCaldavCacheHelpers();

  useSubscription(
    trpc.caldavSubscriptions.onInitialSyncComplete.subscriptionOptions(undefined, {
      onData: (data) => {
        addToast({
          title: "CalDAV Sync Complete",
          description: `Synced ${data.totalSynced} items${data.totalFailed > 0 ? `, ${data.totalFailed} failed` : ""}`,
          color: data.totalFailed > 0 ? "warning" : "success",
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
        invalidateSyncStatus();
        invalidateSummary();
      },
    })
  );
}
