import type { CaldavSyncStatus, CaldavSyncStatusViewDto } from "@norish/shared/contracts";
import type { CaldavRealtime, CaldavSyncEventData } from "@norish/shared/contracts/realtime/caldav";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";

import { usePlatform } from "../platform/platform";
import { useRealtimeSubscription } from "../realtime/use-realtime-subscription";
import { useTRPC } from "../trpc";
import { useCaldavCacheHelpers } from "./use-caldav-cache";

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

/**
 * One subscription carries every CalDAV sync fact; the payload's `type` says
 * which, and each fact is handled once — one toast per initial sync.
 */
export function useCaldavSubscription() {
  const trpc = useTRPC();
  const { setConfig, setStatuses, invalidateSyncStatus, invalidateSummary } =
    useCaldavCacheHelpers();
  const { toast } = usePlatform();

  const showSyncStarted = (queued: number, failed: number) => {
    toast.show({
      severity: failed > 0 ? "warning" : "success",
      title: toast.translate("calendar.caldav.syncStarted"),
      description:
        failed > 0
          ? toast.translate("calendar.caldav.syncStartedWithFailures", { queued, failed })
          : toast.translate("calendar.caldav.syncStartedDescription", { queued }),
    });
  };

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
            showSyncStarted(event.data.totalSynced, event.data.totalFailed);
            invalidateSyncStatus();
            invalidateSummary();
            break;
          default:
            break;
        }
      },
      liveQueryKeys: [
        trpc.caldav.getConfig.queryKey(),
        trpc.caldav.getSyncStatus.pathKey(),
        trpc.caldav.getSummary.queryKey(),
      ],
    }
  );
}
