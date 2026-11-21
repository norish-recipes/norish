"use client";

import type { ArchiveRealtime } from "@norish/shared/contracts/realtime/archive";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";

import { usePlatform } from "../platform";
import { useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { useArchiveImport } from "./archive-import-store";

type Payload<E extends EventName<ArchiveRealtime>> = PayloadOf<ArchiveRealtime, E>;

/** The import's progress, for the screen that draws its bar. */
export function useArchiveImportProgress(): void {
  const trpc = useTRPC();
  const progressed = useArchiveImport((state) => state.progressed);

  // No liveQueryKeys: progress is not a query, and the next event carries the whole count.
  useRealtimeSubscription<Payload<"archiveProgress">>(trpc.archive.onArchiveProgress, {
    onEvent: progressed,
  });
}

/** The import's outcome, applied and toasted once wherever the Reader is while it runs on. */
export function useArchiveImportOutcome(): void {
  const trpc = useTRPC();
  const completed = useArchiveImport((state) => state.completed);
  const { toast } = usePlatform();

  useRealtimeSubscription<Payload<"archiveCompleted">>(trpc.archive.onArchiveCompleted, {
    onEvent: (payload) => {
      completed(payload);
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
