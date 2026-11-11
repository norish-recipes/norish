"use client";

import { useMutation } from "@tanstack/react-query";

import { usePlatform } from "../platform";
import { useTRPC } from "../trpc";
import { useArchiveImport } from "./archive-import-store";

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
