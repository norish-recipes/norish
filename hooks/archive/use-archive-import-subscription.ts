"use client";

import { useSubscription } from "@trpc/tanstack-react-query";
import { addToast } from "@heroui/react";

import { useArchiveImportQuery } from "./use-archive-import-query";

import { createClientLogger } from "@/lib/logger";
import { useTRPC } from "@/app/providers/trpc-provider";

const log = createClientLogger("ArchiveImportSubscription");

/**
 * Hook for subscribing to archive import progress events.
 * Updates import state in query cache. Recipe additions are handled separately
 * via recipeBatchCreated subscription in useRecipesQuery.
 */
export function useArchiveImportSubscription(): void {
  const trpc = useTRPC();
  const { setImportState } = useArchiveImportQuery();

  // Subscribe to progress events (user-scoped)
  useSubscription(
    trpc.archive.onArchiveProgress.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.debug({ payload }, "Progress event received");
        setImportState((prev) => {
          // If no previous state or not importing, initialize with progress data
          if (!prev || !prev.isImporting) {
            return {
              current: payload.current,
              total: payload.total,
              imported: payload.imported,
              skipped: payload.current - payload.imported - payload.errors.length,
              isImporting: true,
              errors: payload.errors,
            };
          }

          const allErrors = [...(prev.errors || []), ...payload.errors];
          // Use imported count from payload, calculate skipped
          const skipped = payload.current - payload.imported - allErrors.length;

          return {
            ...prev,
            current: payload.current,
            imported: payload.imported,
            errors: allErrors,
            skipped: Math.max(0, skipped),
          };
        });
      },
    })
  );

  // Subscribe to completion events (user-scoped)
  useSubscription(
    trpc.archive.onArchiveCompleted.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.debug({ payload }, "Completion event received");
        // Update state to mark import as complete
        setImportState((prev) => {
          // Always accept completion, even if state is undefined
          const total = prev?.total ?? payload.imported + payload.skipped + payload.errors.length;

          return {
            current: total,
            total: total,
            imported: payload.imported,
            skipped: payload.skipped,
            isImporting: false,
            errors: payload.errors,
          };
        });

        // Show completion toast
        const hasErrors = payload.errors.length > 0;
        const hasSkipped = payload.skipped > 0;

        let description: string;

        if (hasErrors && hasSkipped) {
          description = `Imported ${payload.imported} recipes, skipped ${payload.skipped} duplicates, ${payload.errors.length} errors`;
        } else if (hasErrors) {
          description = `Imported ${payload.imported} recipes with ${payload.errors.length} errors`;
        } else if (hasSkipped) {
          description = `Imported ${payload.imported} recipes, skipped ${payload.skipped} duplicates`;
        } else {
          description = `Imported ${payload.imported} recipes`;
        }

        addToast({
          severity: hasErrors ? "warning" : "success",
          title: "Recipe import complete",
          description,
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
      },
    })
  );
}
