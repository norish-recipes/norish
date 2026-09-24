import type { CaldavSyncStatus, CaldavSyncStatusViewDto } from "@norish/shared/contracts";
import type { CaldavRealtime, CaldavSyncEventData } from "@norish/shared/contracts/realtime/caldav";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";

import type { CaldavCacheHelpers, CreateCaldavHooksOptions } from "./types";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";

type CaldavItemStatusUpdatedPayload = CaldavSyncEventData["itemStatusUpdated"];

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

/**
 * One subscription carries every CalDAV sync fact; the payload's `type` says
 * which, and each fact is handled once — one toast per initial sync.
 */
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

    useRealtimeSubscription<PayloadOf<CaldavRealtime, "syncEvent">>(
      trpc.caldavSubscriptions.onSyncEvent,
      {
        onEvent: (event) => {
          switch (event.type) {
            case "configSaved":
              setConfig(() => event.data.config);
              break;
            case "syncCompleted":
            case "syncFailed":
              invalidateSyncStatus();
              invalidateSummary();
              break;
            case "itemStatusUpdated":
              setStatuses((prev) => {
                if (!prev) return prev;

                return {
                  ...prev,
                  statuses: applyCaldavStatusUpdate(prev.statuses, event.data, new Date()),
                };
              });
              invalidateSummary();
              break;
            case "initialSyncComplete":
              toastAdapter.showSyncCompleteToast(event.data.totalSynced, event.data.totalFailed);
              invalidateSyncStatus();
              invalidateSummary();
              break;
            default:
              break;
          }
        },
        onLag: () => {
          invalidateSyncStatus();
          invalidateSummary();
        },
      }
    );
  }

  return { useCaldavSubscription };
}
