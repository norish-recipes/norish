import type { ArchiveRealtime } from "@norish/shared/contracts/realtime/archive";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import { createClientLogger } from "@norish/shared/lib/logger";

import type { ArchiveImportCacheHelpers, CreateArchiveHooksOptions } from "./types";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";

type Payload<E extends EventName<ArchiveRealtime>> = PayloadOf<ArchiveRealtime, E>;

const log = createClientLogger("ArchiveImportSubscription");

export type ArchiveSubscriptionToastAdapter = {
  showCompletionToast: (imported: number, notes: number, errors: number) => void;
};

type CreateUseArchiveSubscriptionOptions = CreateArchiveHooksOptions & {
  useArchiveImportCacheHelpers: () => ArchiveImportCacheHelpers;
  useToastAdapter: () => ArchiveSubscriptionToastAdapter;
};

export function createUseArchiveSubscription({
  useTRPC,
  useArchiveImportCacheHelpers,
  useToastAdapter,
}: CreateUseArchiveSubscriptionOptions) {
  return function useArchiveImportSubscription(): void {
    const trpc = useTRPC();
    const { setImportState } = useArchiveImportCacheHelpers();
    const toastAdapter = useToastAdapter();

    // An import's progress is not a query: a lag has nothing to refetch, and
    // the next progress event carries the whole count again.
    const lag = {
      onLag: () => log.warn("Archive import subscription lagged; awaiting next event"),
    };

    useRealtimeSubscription<Payload<"archiveProgress">>(trpc.archive.onArchiveProgress, {
      ...lag,
      onEvent: (payload) => {
        log.debug({ payload }, "Progress event received");
        setImportState((prev) => {
          if (!prev || !prev.isImporting) {
            return {
              current: payload.current,
              total: payload.total,
              imported: payload.imported,
              notes: [],
              isImporting: true,
              errors: payload.errors,
            };
          }

          const allErrors = [...(prev.errors || []), ...payload.errors];

          return {
            ...prev,
            current: payload.current,
            imported: payload.imported,
            errors: allErrors,
          };
        });
      },
    });

    useRealtimeSubscription<Payload<"archiveCompleted">>(trpc.archive.onArchiveCompleted, {
      ...lag,
      onEvent: (payload) => {
        log.debug({ payload }, "Completion event received");
        setImportState((prev) => {
          const total = prev?.total ?? payload.imported + payload.errors.length;

          return {
            current: total,
            total: total,
            imported: payload.imported,
            notes: payload.notes,
            isImporting: false,
            errors: payload.errors,
          };
        });

        toastAdapter.showCompletionToast(
          payload.imported,
          payload.notes.length,
          payload.errors.length
        );
      },
    });
  };
}
