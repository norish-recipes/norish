import { useSubscription } from "@trpc/tanstack-react-query";

import type { CaldavSyncStatus, CaldavSyncStatusViewDto } from "@norish/shared/contracts";
import type { CaldavSubscriptionEvents } from "@norish/trpc";
import { createClientLogger } from "@norish/shared/lib/logger";

import type { CaldavCacheHelpers, CreateCaldavHooksOptions } from "./types";

const log = createClientLogger("CaldavSubscription");

type SyncEventPayload = {
  type: keyof CaldavSubscriptionEvents;
  data: CaldavSubscriptionEvents[keyof CaldavSubscriptionEvents];
};

type CaldavItemStatusUpdatedPayload = {
  itemId: string;
  itemType: "recipe" | "note";
  syncStatus: "pending" | "synced" | "failed" | "removed";
  errorMessage: string | null;
  caldavEventUid: string | null;
  version: number;
};

export function applyCaldavStatusUpdate(
  statuses: CaldavSyncStatusViewDto[],
  payload: CaldavItemStatusUpdatedPayload,
  lastSyncAt: Date
): CaldavSyncStatusViewDto[] {
  const { itemId, itemType, syncStatus, errorMessage, caldavEventUid, version } = payload;

  return statuses.map((status) => {
    if (status.itemId === itemId && status.itemType === itemType) {
      return {
        ...status,
        syncStatus: syncStatus as CaldavSyncStatus,
        errorMessage,
        caldavEventUid,
        version,
        lastSyncAt,
      } satisfies CaldavSyncStatusViewDto;
    }

    return status;
  });
}

export type CaldavSubscriptionToastAdapter = {
  showSyncCompleteToast: (totalSynced: number, totalFailed: number) => void;
};

type CreateUseCaldavSubscriptionOptions = CreateCaldavHooksOptions & {
  useCaldavCacheHelpers: () => CaldavCacheHelpers;
  useToastAdapter: () => CaldavSubscriptionToastAdapter;
};

export function createUseCaldavSubscription({
  useTRPC,
  useCaldavCacheHelpers,
  useToastAdapter,
}: CreateUseCaldavSubscriptionOptions) {
  function useCaldavSubscription() {
    const trpc = useTRPC();
    const { setConfig, setStatuses, invalidateSyncStatus, invalidateSummary } =
      useCaldavCacheHelpers();
    const toastAdapter = useToastAdapter();

    useSubscription(
      trpc.caldavSubscriptions.onSyncEvent.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          const { type, data } = payload as SyncEventPayload;

          if (type === "configSaved") {
            const payload = data as CaldavSubscriptionEvents["configSaved"];

            setConfig(() => payload.config);
          } else if (type === "syncCompleted" || type === "syncFailed") {
            invalidateSyncStatus();
            invalidateSummary();
          } else if (type === "itemStatusUpdated") {
            const payload = data as CaldavItemStatusUpdatedPayload;

            setStatuses((prev) => {
              if (!prev) return prev;

              const updatedStatuses = applyCaldavStatusUpdate(prev.statuses, payload, new Date());

              return { ...prev, statuses: updatedStatuses };
            });
            invalidateSummary();
          } else if (type === "initialSyncComplete") {
            const payload = data as CaldavSubscriptionEvents["initialSyncComplete"];

            toastAdapter.showSyncCompleteToast(payload.totalSynced, payload.totalFailed);
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

  function useCaldavItemStatusSubscription() {
    const trpc = useTRPC();
    const { setStatuses, invalidateSummary } = useCaldavCacheHelpers();

    useSubscription(
      trpc.caldavSubscriptions.onItemStatusUpdated.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          const data = payload as CaldavItemStatusUpdatedPayload;

          setStatuses((prev) => {
            if (!prev) return prev;

            const updatedStatuses = applyCaldavStatusUpdate(prev.statuses, data, new Date());

            return { ...prev, statuses: updatedStatuses };
          });

          invalidateSummary();
        },
      })
    );
  }

  function useCaldavSyncCompleteSubscription() {
    const trpc = useTRPC();
    const { invalidateSyncStatus, invalidateSummary } = useCaldavCacheHelpers();
    const toastAdapter = useToastAdapter();

    useSubscription(
      trpc.caldavSubscriptions.onInitialSyncComplete.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          const data = payload;

          toastAdapter.showSyncCompleteToast(data.totalSynced, data.totalFailed);
          invalidateSyncStatus();
          invalidateSummary();
        },
      })
    );
  }

  return {
    useCaldavSubscription,
    useCaldavItemStatusSubscription,
    useCaldavSyncCompleteSubscription,
  };
}
