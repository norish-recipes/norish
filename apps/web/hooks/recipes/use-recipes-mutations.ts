"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useWarmSet } from "@/hooks/use-warm-set";
import { isQueuedForReplay, showQueuedOfflineToast } from "@/lib/ui/queued-offline-toast";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useTranslations } from "next-intl";

import type { RecipesMutationsResult } from "@norish/shared-react/hooks";
import {
  createUseRecipesCacheHelpers,
  createUseRecipesMutations,
} from "@norish/shared-react/hooks/recipes/dashboard";

const useRecipesCacheHelpers = createUseRecipesCacheHelpers({ useTRPC });
const useSharedRecipesMutations = createUseRecipesMutations(
  { useTRPC },
  { useRecipesCacheHelpers }
);

export type { RecipesMutationsResult };

export function useRecipesMutations(): RecipesMutationsResult {
  const warmSet = useWarmSet();
  const tErrors = useTranslations("common.errors");
  const tQueued = useTranslations("common.queuedOffline");

  const showMutationErrorToast = (error: unknown, operation: string): void => {
    // Backend-unreachable is the Queued outcome, not a failure: the Outbox has
    // captured the mutation (an import simply runs at Replay time), so tell the
    // user it's saved and will happen — never show an error toast for it.
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

  return useSharedRecipesMutations(showMutationErrorToast, warmSet.promoteCreatedRecipe);
}
