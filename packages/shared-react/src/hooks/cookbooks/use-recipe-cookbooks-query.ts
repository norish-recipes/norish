import { useQuery } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../recipes/types";
import type { EditableCookbooksQueryResult, RecipeCookbooksQueryResult } from "./types";

/** The cookbooks a recipe is in, as the recipe page's card lists them. */
export function createUseRecipeCookbooksQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRecipeCookbooksQuery(
    recipeId: string | null,
    { enabled = true }: { enabled?: boolean } = {}
  ): RecipeCookbooksQueryResult {
    "use memo";

    const trpc = useTRPC();
    const { data, isLoading } = useQuery({
      ...trpc.cookbooks.forRecipe.queryOptions({ recipeId: recipeId ?? "" }),
      enabled: enabled && Boolean(recipeId),
    });

    return { cookbooks: data ?? [], isLoading };
  };
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
export function createUseEditableCookbooksQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useEditableCookbooksQuery(
    recipeId: string | null,
    { enabled = true }: { enabled?: boolean } = {}
  ): EditableCookbooksQueryResult {
    "use memo";

    const trpc = useTRPC();
    const editable = useQuery({
      ...trpc.cookbooks.editable.queryOptions(),
      enabled,
    });
    const membership = useQuery({
      ...trpc.cookbooks.forRecipe.queryOptions({ recipeId: recipeId ?? "" }),
      enabled: enabled && Boolean(recipeId),
    });

    const memberOf = new Set((membership.data ?? []).map((cookbook) => cookbook.id));

    return {
      cookbooks: (editable.data ?? []).map((cookbook) => ({
        ...cookbook,
        containsRecipe: memberOf.has(cookbook.id),
      })),
      isLoading: editable.isLoading || membership.isLoading,
    };
  };
}
