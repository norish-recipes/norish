"use client";

import { useCallback } from "react";
import { useUserContext } from "@/context/user-context";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { RecipeEnrichmentKind } from "@norish/shared/lib/recipe-enrichment";

import { sharedRecipeFamilyHooks } from "./shared-recipe-hooks";

const sharedUseRecipeEnrichment = sharedRecipeFamilyHooks.useRecipeEnrichment;

/**
 * Recipe Enrichment lifecycle and manual requests for every kind.
 *
 * Only failures of runs this user asked for surface as a toast. Automatic
 * enrichment stays quiet: it is optional background work, and an error there
 * would read as the recipe itself having failed.
 */
export function useRecipeEnrichment(recipeId: string) {
  const { user } = useUserContext();
  const t = useTranslations("recipes.enrichment");

  const onManualError = useCallback(
    (kind: RecipeEnrichmentKind, error: unknown) => {
      toast(t("failed"), {
        variant: "danger",
        description: error instanceof Error && error.message ? error.message : t(`kinds.${kind}`),
      });
    },
    [t]
  );

  return sharedUseRecipeEnrichment(recipeId, user?.id ?? null, { onManualError });
}
