"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { toast } from "@heroui/react";
import { useSubscription } from "@trpc/tanstack-react-query";

import { createClientLogger } from "@norish/shared/lib/logger";

import { useArchiveImportCacheHelpers } from "./use-archive-cache";

const log = createClientLogger("ArchiveImportSubscription");

/**
 * Hook for subscribing to archive import progress events.
 * Updates import state in query cache. Recipe additions are handled separately
 * via recipeBatchCreated subscription in useRecipesQuery.
 *
 * Uses cache helpers instead of query hook to avoid duplicate observers.
 */
export function useArchiveImportSubscription(): void {
  const trpc = useTRPC();
  const { setImportState } = useArchiveImportCacheHelpers();

  // Subscribe to progress events (user-scoped)
  useSubscription(
    trpc.archive.onArchiveProgress.subscriptionOptions(undefined, {
      onData: ({ payload }: any) => {
        log.debug({ payload }, "Progress event received");
        setImportState((prev) => {
          // If no previous state or not importing, initialize with progress data
          if (!prev || !prev.isImporting) {
            return {
              current: payload.current,
              total: payload.total,
              imported: payload.imported,
              notes: [], // Populated on completion
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
    })
  );

  // Subscribe to completion events (user-scoped)
  useSubscription(
    trpc.archive.onArchiveCompleted.subscriptionOptions(undefined, {
      onData: ({ payload }: any) => {
        log.debug({ payload }, "Completion event received");
        // Update state to mark import as complete
        setImportState((prev) => {
          // Always accept completion, even if state is undefined
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

        // Show completion toast
        const hasErrors = payload.errors.length > 0;
        const noteCount = payload.notes.length;

        let description: string;

        if (hasErrors && noteCount > 0) {
          description = `Imported ${payload.imported} recipes, ${noteCount} with notes, ${payload.errors.length} errors`;
        } else if (hasErrors) {
          description = `Imported ${payload.imported} recipes with ${payload.errors.length} errors`;
        } else if (noteCount > 0) {
          description = `Imported ${payload.imported} recipes, ${noteCount} with notes`;
        } else {
          description = `Imported ${payload.imported} recipes`;
        }

        toast("Recipe import complete", {
          description: description,
          variant: hasErrors ? "warning" : "success",
        });
      },
    })
  );
}
