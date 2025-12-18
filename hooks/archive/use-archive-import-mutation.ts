"use client";

import { useMutation } from "@tanstack/react-query";
import { addToast } from "@heroui/react";

import { useArchiveImportQuery } from "./use-archive-import-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type ArchiveImportMutationResult = {
  startImport: (file: File) => void;
  isStarting: boolean;
};

/**
 * Hook for starting archive import (Mela/Mealie/Tandoor).
 * Initializes import state and triggers background processing.
 */
export function useArchiveImportMutation(): ArchiveImportMutationResult {
  const trpc = useTRPC();
  const { setImportState } = useArchiveImportQuery();

  // Mutation for starting import
  const startMutation = useMutation(trpc.archive.importArchive.mutationOptions());

  const startImport = (file: File) => {
    const formData = new FormData();

    formData.append("file", file);

    startMutation.mutate(formData, {
      onSuccess: (result) => {
        if (result.success) {
          // Initialize import state
          setImportState(() => ({
            current: 0,
            total: result.total!,
            imported: 0,
            skipped: 0,
            isImporting: true,
            errors: [],
          }));

          addToast({
            severity: "default",
            title: "Recipe import started",
            description: `Importing ${result.total} recipes...`,
            timeout: 2000,
            shouldShowTimeoutProgress: true,
            radius: "full",
          });
        } else {
          addToast({
            severity: "danger",
            title: "Import failed",
            description: result.error || "Unknown error",
            timeout: 2000,
            shouldShowTimeoutProgress: true,
            radius: "full",
          });
        }
      },
      onError: (error) => {
        addToast({
          severity: "danger",
          title: "Import failed",
          description: String(error),
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
      },
    });
  };

  return {
    startImport,
    isStarting: startMutation.isPending,
  };
}
