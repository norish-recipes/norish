"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
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
