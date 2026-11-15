"use client";

import { useRouter } from "next/navigation";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useRecipeSubscription as useSharedRecipeSubscription } from "@norish/shared-react/recipes";

export function useRecipeSubscription(recipeId: string | null) {
  const tErrors = useTranslations("common.errors");
  const tToasts = useTranslations("recipes.toasts");
  const router = useRouter();

  useSharedRecipeSubscription(recipeId, {
    onDeleted: () => {
      toast(tToasts("deleted"), { description: tToasts("deletedDescription"), variant: "warning" });

      router.push("/");
    },
    onFailed: (payload) => {
      showSafeErrorToast({
        title: tErrors("operationFailed"),
        description: tErrors("technicalDetails"),
        error: payload.reason,
        context: "recipe-subscription:onFailed",
        metadata: { recipeId, payloadRecipeId: payload.recipeId ?? null },
      });
    },
  });
}
