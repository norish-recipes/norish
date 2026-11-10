"use client";

import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { RecipeEnrichmentKind } from "@norish/shared/lib/recipe-enrichment";
import {
  useRecipeEnrichment as useSharedRecipeEnrichment,
  useRecipeEnrichmentSubscription as useSharedRecipeEnrichmentSubscription,
} from "@norish/shared-react/recipes";

/**
 * Only failures of runs this user asked for surface as a toast. Automatic
 * enrichment stays quiet: it is optional background work, and an error there
 * would read as the recipe itself having failed.
 */
function useManualErrorToast() {
  const t = useTranslations("recipes.enrichment");

  return (kind: RecipeEnrichmentKind, error: unknown) => {
    toast(t("failed"), {
      variant: "danger",
      description: error instanceof Error && error.message ? error.message : t(`kinds.${kind}`),
    });
  };
}

/** Recipe Enrichment lifecycle and manual requests for every kind. */
export function useRecipeEnrichment(recipeId: string) {
  const onManualError = useManualErrorToast();

  return useSharedRecipeEnrichment(recipeId, { onManualError });
}

/** The recipe's enrichment events; the recipe page mounts it once. */
export function useRecipeEnrichmentSubscription(recipeId: string) {
  const onManualError = useManualErrorToast();

  useSharedRecipeEnrichmentSubscription(recipeId, { onManualError });
}
