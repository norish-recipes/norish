"use client";

import { isQueuedForReplay, showQueuedOfflineToast } from "@/lib/ui/queued-offline-toast";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useTranslations } from "next-intl";

import type { RecipesMutationsResult } from "@norish/shared-react/recipes";
import { useRecipesMutations as useSharedRecipesMutations } from "@norish/shared-react/recipes";

/** The toast a failed recipe write shows; recipe imports show it too. */
export function useRecipeMutationErrorToast(): (error: unknown, operation: string) => void {
  const tErrors = useTranslations("common.errors");
  const tQueued = useTranslations("common.queuedOffline");

  return (error, operation) => {
    // Backend-unreachable is the Queued outcome, not a failure: the Outbox has
    // captured the write, so say it's saved and never show an error for it.
    if (isQueuedForReplay(error)) {
      showQueuedOfflineToast({
        title: tQueued("title"),
        description: tQueued("description"),
      });

      return;
    }

    showSafeErrorToast({
      title: tErrors("operationFailed"),
      description: tErrors("technicalDetails"),
      color: "default",
      error,
      context: `recipes-mutations:${operation}`,
    });
  };
}

export function useRecipesMutations(): RecipesMutationsResult {
  return useSharedRecipesMutations(useRecipeMutationErrorToast());
}
