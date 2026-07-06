"use client";

import { useRouter } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  createUseRecipeQuery,
  createUseRecipeSubscription,
} from "@norish/shared-react/hooks/recipes/recipe";

const useRecipeQuery = createUseRecipeQuery({ useTRPC });
const useSharedRecipeSubscription = createUseRecipeSubscription({ useTRPC }, { useRecipeQuery });

export function useRecipeSubscription(recipeId: string | null) {
  const tErrors = useTranslations("common.errors");
  const router = useRouter();

  useSharedRecipeSubscription(recipeId, {
    onConverted: (rawPayload) => {
      const payload = rawPayload as { recipe: { systemUsed: string } };

      toast("Measurements converted", {
        description: `Recipe converted to ${payload.recipe.systemUsed} units`,
        variant: "success",
      });
    },
    onDeleted: () => {
      toast("Recipe deleted", { description: "This recipe has been removed.", variant: "warning" });

      router.push("/");
    },
    onFailed: (rawPayload) => {
      const payload = rawPayload as { reason: string; recipeId: string | null };

      showSafeErrorToast({
        title: tErrors("operationFailed"),
        description: tErrors("technicalDetails"),
        error: payload.reason,
        context: "recipe-subscription:onFailed",
        metadata: { recipeId, payloadRecipeId: payload.recipeId },
      });
    },
  });
}
