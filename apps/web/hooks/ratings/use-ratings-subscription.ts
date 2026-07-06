"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useTranslations } from "next-intl";

import { createUseRatingsSubscription } from "@norish/shared-react/hooks/recipes/dashboard";

const useSharedRatingsSubscription = createUseRatingsSubscription({ useTRPC });

export function useRatingsSubscription() {
  const tErrors = useTranslations("common.errors");

  useSharedRatingsSubscription({
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
