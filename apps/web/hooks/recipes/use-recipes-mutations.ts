"use client";

import type { RecipesMutationsResult } from "@norish/shared-react/hooks";

import { useTranslations } from "next-intl";


import { sharedDashboardRecipeHooks } from "./shared-recipe-hooks";

import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";

export type { RecipesMutationsResult };

export function useRecipesMutations(): RecipesMutationsResult {
  const tErrors = useTranslations("common.errors");
  const useSharedRecipesMutations = sharedDashboardRecipeHooks.useRecipesMutations;

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
