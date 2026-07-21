"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { CACHE_MAX_AGE_MS } from "@/lib/query-cache";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useTranslations } from "next-intl";

import type { RecipesMutationsResult } from "@norish/shared-react/hooks";
import {
  createUseRecipesCacheHelpers,
  createUseRecipesMutations,
} from "@norish/shared-react/hooks/recipes/dashboard";

const useRecipesCacheHelpers = createUseRecipesCacheHelpers({ useTRPC });
// Stamp the Warm Set gcTime on freshly-created recipes so they are offline-
// available immediately (ADR-0008). CACHE_MAX_AGE_MS is the same 7-day value the
// Cache Warmer uses, kept web-side and injected across the shared/web boundary.
const useSharedRecipesMutations = createUseRecipesMutations(
  { useTRPC, warmRecipeGcTime: CACHE_MAX_AGE_MS },
  { useRecipesCacheHelpers }
);

export type { RecipesMutationsResult };

export function useRecipesMutations(): RecipesMutationsResult {
  const tErrors = useTranslations("common.errors");

  const showMutationErrorToast = (error: unknown, operation: string): void => {
    showSafeErrorToast({
      title: tErrors("operationFailed"),
      description: tErrors("technicalDetails"),
      color: "default",
      error,
      context: `recipes-mutations:${operation}`,
    });
  };

  return useSharedRecipesMutations(showMutationErrorToast);
}
