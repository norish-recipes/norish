import type { RecipeIngredientsDto } from "@norish/shared/contracts";
import { selectRowsForSystem } from "@norish/shared/lib/linked-recipes";

import type { RecipeQueryResult } from "./use-recipe-query";

/* The zod-derived DTO collapses to `unknown` in TS setups that mix zod v3/v4
   types, and `unknown[]` fails the selector's constraint; intersecting keeps
   the systemUsed field visible either way. */
export type SystemScopedIngredientDto = RecipeIngredientsDto & { systemUsed: string };

/* recipeIngredients holds one entry per unit system; returning the list
   unfiltered shows every ingredient once per system. Pick the preferred
   system when present, otherwise the recipe's own system, otherwise
   whichever system the entries actually use. */
export const selectIngredientsForSystem = selectRowsForSystem;

export function createUseRecipeIngredients(
  useRecipeQuery: (id: string | null) => RecipeQueryResult
) {
  return function useRecipeIngredients(id: string | null) {
    const { recipe, isLoading, error } = useRecipeQuery(id);

    return {
      ingredients: recipe
        ? selectIngredientsForSystem(
            recipe.recipeIngredients as SystemScopedIngredientDto[],
            recipe.systemUsed,
            recipe.systemUsed
          )
        : ([] as SystemScopedIngredientDto[]),
      systemUsed: recipe?.systemUsed ?? null,
      recipe,
      isLoading,
      error,
    };
  };
}
