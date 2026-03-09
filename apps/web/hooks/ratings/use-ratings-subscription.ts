"use client";

import { sharedDashboardRecipeHooks } from "@/hooks/recipes/shared-recipe-hooks";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useTranslations } from "next-intl";

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
