import type { ArchiveRealtime } from "@norish/shared/contracts/realtime/archive";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import { createClientLogger } from "@norish/shared/lib/logger";

import type { ArchiveImportCacheHelpers, CreateArchiveHooksOptions } from "./types";
import { usePlatform } from "../../platform/platform";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";

type Payload<E extends EventName<ArchiveRealtime>> = PayloadOf<ArchiveRealtime, E>;

const log = createClientLogger("ArchiveImportSubscription");

type CreateUseArchiveSubscriptionOptions = CreateArchiveHooksOptions & {
  useArchiveImportCacheHelpers: () => ArchiveImportCacheHelpers;
};

/**
 * An archive import's two halves: its progress, for the screen that draws the bar, and its
 * outcome, applied and toasted once wherever the reader is while it runs on.
 */
export function createUseArchiveSubscriptions({
  useTRPC,
  useArchiveImportCacheHelpers,
}: CreateUseArchiveSubscriptionOptions) {
  function useArchiveImportProgress(): void {
    "use memo";

    const trpc = useTRPC();
    const { setImportState } = useArchiveImportCacheHelpers();

    // No liveQueryKeys: progress is not a query, and the next event carries the whole count.
    useRealtimeSubscription<Payload<"archiveProgress">>(trpc.archive.onArchiveProgress, {
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
  }

  function useArchiveImportOutcome(): void {
    "use memo";

    const trpc = useTRPC();
    const { setImportState } = useArchiveImportCacheHelpers();
    const { toast } = usePlatform();

    useRealtimeSubscription<Payload<"archiveCompleted">>(trpc.archive.onArchiveCompleted, {
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

        const errors = payload.errors.length;

        // One message covers all four outcomes: the note and error clauses drop out at zero.
        toast.show({
          severity: errors > 0 ? "warning" : "success",
          title: toast.translate("navbar.archiveImporter.toasts.completeTitle"),
          description: toast.translate("navbar.archiveImporter.toasts.completeDescription", {
            imported: payload.imported,
            notes: payload.notes.length,
            errors,
          }),
        });
      },
    });
  }

  return { useArchiveImportProgress, useArchiveImportOutcome };
}
