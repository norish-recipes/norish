"use client";

import { useRouter } from "next/navigation";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  createUseRecipeQuery,
  createUseRecipeSubscription,
} from "@norish/shared-react/hooks/recipes/recipe";
import { useTRPC } from "@norish/shared-react/trpc";

const useRecipeQuery = createUseRecipeQuery({ useTRPC });
const useSharedRecipeSubscription = createUseRecipeSubscription({ useTRPC }, { useRecipeQuery });

export function useRecipeSubscription(recipeId: string | null) {
  const tErrors = useTranslations("common.errors");
  const router = useRouter();

  useSharedRecipeSubscription(recipeId, {
    onDeleted: () => {
      toast("Recipe deleted", { description: "This recipe has been removed.", variant: "warning" });

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
