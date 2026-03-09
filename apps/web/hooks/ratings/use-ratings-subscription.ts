"use client";

import { useTranslations } from "next-intl";

import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";

import { sharedDashboardRecipeHooks } from "@/hooks/recipes/shared-recipe-hooks";

export function useRatingsSubscription() {
  const tErrors = useTranslations("common.errors");

  sharedDashboardRecipeHooks.useRatingsSubscription({
    onRatingFailed: ({ recipeId, reason }) => {
      showSafeErrorToast({
        title: tErrors("operationFailed"),
        description: tErrors("technicalDetails"),
        error: reason,
        context: "ratings-subscription:onRatingFailed",
        metadata: { recipeId },
      });
    },
  });
}
