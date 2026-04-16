"use client";

import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { addToast, Button } from "@heroui/react";
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
  const t = useTranslations("recipes.toasts");

  useSharedRecipesSubscription({
    onImported: (rawPayload) => {
      const payload = rawPayload as { toast?: string; recipe: { id: string } };

      if (payload.toast === "imported") {
        addToast({
          severity: "success",
          title: t("imported"),
          shouldShowTimeoutProgress: true,
          radius: "full",
          classNames: {
            closeButton: "opacity-100 absolute right-4 top-1/2 -translate-y-1/2",
          },
          endContent: (
            <Link href={`/recipes/${payload.recipe.id}`}>
              <Button color="primary" radius="full" size="sm" variant="solid">
                {t("open")}
              </Button>
            </Link>
          ),
        });
      }
    },
    onConverted: (rawPayload) => {
      const payload = rawPayload as { recipe: { systemUsed: string } };

      addToast({
        severity: "success",
        title: t("converted"),
        description: t("convertedDescription", { system: payload.recipe.systemUsed }),
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    },
    onFailed: () => {
      addToast({
        severity: "danger",
        title: t("failed"),
        shouldShowTimeoutProgress: true,
        radius: "full",
        description: t("failedDescription"),
        classNames: {
          closeButton: "opacity-100 absolute right-4 top-1/2 -translate-y-1/2",
        },
      });
    },
    onProcessingToast: (rawPayload) => {
      const payload = rawPayload as {
        recipeId: string;
        titleKey: string;
        severity: "success" | "warning" | "danger" | "secondary";
      };

      addToast({
        severity: payload.severity,
        title: t(payload.titleKey),
        timeout: payload.severity === "success" ? 2000 : 3000,
        shouldShowTimeoutProgress: true,
        radius: "full",
        classNames: {
          closeButton: "opacity-100 absolute right-4 top-1/2 -translate-y-1/2",
        },
        endContent: (
          <Link href={`/recipes/${payload.recipeId}`}>
            <Button color="primary" radius="full" size="sm" variant="solid">
              {t("open")}
            </Button>
          </Link>
        ),
      });
    },
  });
}
