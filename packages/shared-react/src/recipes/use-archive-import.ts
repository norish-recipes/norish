"use client";

import { useMutation } from "@tanstack/react-query";

import type { ArchiveRealtime } from "@norish/shared/contracts/realtime/archive";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";

import { usePlatform } from "../platform";
import { useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { useArchiveImport } from "./archive-import-store";

type Payload<E extends EventName<ArchiveRealtime>> = PayloadOf<ArchiveRealtime, E>;

/** Uploads a Recipe Archive; the import then runs on the server. */
export function useArchiveImportMutation() {
  const trpc = useTRPC();
  const { toast, showError } = usePlatform();
  const started = useArchiveImport((state) => state.started);
  const context = "archive-import:start";

  const { mutate, isPending } = useMutation(
    trpc.archive.importArchive.mutationOptions({
      onSuccess: (answer) => {
        if (!answer.success || answer.total === undefined) {
          showError(answer.error ?? "Unknown error", context);

          return;
        }
        started(answer.total);
        toast.show({
          severity: "default",
          title: toast.translate("navbar.archiveImporter.toasts.startTitle"),
          description: toast.translate("navbar.archiveImporter.toasts.startDescription", {
            count: answer.total,
          }),
        });
      },
      onError: (error) => showError(error, context),
    })
  );

  return {
    startImport: (file: File) => {
      const formData = new FormData();

      formData.append("file", file);
      // The router validates FormData at runtime; its declared input is a structural upload type.
      mutate(formData as unknown as Parameters<typeof mutate>[0]);
    },
    isStarting: isPending,
  };
}

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
