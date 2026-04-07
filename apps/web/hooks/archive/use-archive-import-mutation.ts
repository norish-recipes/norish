"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { addToast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useArchiveImportQuery } from "./use-archive-import-query";

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
  const tErrors = useTranslations("common.errors");
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
            skippedItems: [],
            errors: [],
          }));

          addToast({
            severity: "default",
            title: "Recipe import started",
            description: `Importing ${result.total} recipes...`,
            shouldShowTimeoutProgress: true,
            radius: "full",
          });
        } else {
          showSafeErrorToast({
            title: tErrors("operationFailed"),
            description: tErrors("technicalDetails"),
            error: result.error || "Unknown error",
            context: "archive-import:start",
          });
        }
      },
      onError: (error) => {
        showSafeErrorToast({
          title: tErrors("operationFailed"),
          description: tErrors("technicalDetails"),
          error,
          context: "archive-import:start",
        });
      },
    });
  };

  return {
    startImport,
    isStarting: startMutation.isPending,
  };
}
