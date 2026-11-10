"use client";

import { useQuery } from "@tanstack/react-query";

import type { EditableCookbooksQueryResult, RecipeCookbooksQueryResult } from "./cookbook-types";
import { useTRPC } from "../trpc";

/** The cookbooks a recipe is in, as the recipe page's card lists them. */
export function useRecipeCookbooksQuery(
  recipeId: string | null,
  { enabled = true }: { enabled?: boolean } = {}
): RecipeCookbooksQueryResult {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery({
    ...trpc.cookbooks.forRecipe.queryOptions({ recipeId: recipeId ?? "" }),
    enabled: enabled && Boolean(recipeId),
  });

  return { cookbooks: data ?? [], isLoading };
}

/**
 * Every cookbook the reader may edit, each saying whether it already holds
 * this recipe.
 *
 * Two reads rather than one: which cookbooks may be edited does not depend on
 * the recipe, so it is one cached answer for every recipe page — which is
 * what lets the Warm Set guarantee filing Offline without a read per recipe
 * (ADR-0009). The membership half is the recipe's own read, so the toggles
 * and the recipe page's card always agree.
 */
export function useEditableCookbooksQuery(recipeId: string | null): EditableCookbooksQueryResult {
  const trpc = useTRPC();
  const editable = useQuery(trpc.cookbooks.editable.queryOptions());
  const membership = useQuery({
    ...trpc.cookbooks.forRecipe.queryOptions({ recipeId: recipeId ?? "" }),
    enabled: Boolean(recipeId),
  });

  const memberOf = new Set((membership.data ?? []).map((cookbook) => cookbook.id));

  return {
    cookbooks: (editable.data ?? []).map((cookbook) => ({
      ...cookbook,
      containsRecipe: memberOf.has(cookbook.id),
    })),
    isLoading: editable.isLoading || membership.isLoading,
  };
}
