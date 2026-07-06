"use client";

import { useRouter } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  createUseRecipesCacheHelpers,
  createUseRecipesSubscription,
} from "@norish/shared-react/hooks/recipes/dashboard";

const useRecipesCacheHelpers = createUseRecipesCacheHelpers({ useTRPC });
const useSharedRecipesSubscription = createUseRecipesSubscription(
  { useTRPC },
  { useRecipesCacheHelpers }
);

export function useRecipesSubscription() {
  const router = useRouter();
  const t = useTranslations("recipes.toasts");

  useSharedRecipesSubscription({
    onImported: (rawPayload) => {
      const payload = rawPayload as { toast?: string; recipe: { id: string } };

      if (payload.toast === "imported") {
        toast(t("imported"), {
          variant: "success",
          actionProps: {
            children: t("open"),
            onPress: () => router.push(`/recipes/${payload.recipe.id}`),
          },
        });
      }
    },
    onConverted: (rawPayload) => {
      const payload = rawPayload as { recipe: { systemUsed: string } };

      toast(t("converted"), {
        description: t("convertedDescription", { system: payload.recipe.systemUsed }),
        variant: "success",
      });
    },
    onFailed: () => {
      toast(t("failed"), {
        variant: "danger",
        description: t("failedDescription"),
      });
    },
    onProcessingToast: (rawPayload) => {
      const payload = rawPayload as {
        recipeId: string;
        titleKey: string;
        severity: "success" | "warning" | "danger" | "secondary";
      };

      toast(t(payload.titleKey), {
        variant: payload.severity === "secondary" ? "accent" : payload.severity,
        timeout: payload.severity === "success" ? 2000 : 3000,
        actionProps: {
          children: t("open"),
          onPress: () => router.push(`/recipes/${payload.recipeId}`),
        },
      });
    },
  });
}
