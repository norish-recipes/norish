import type { RecipeIngredientsDto } from "@norish/shared/contracts";

import type { RecipeQueryResult } from "./use-recipe-query";

export function createUseRecipeIngredients(
  useRecipeQuery: (id: string | null) => RecipeQueryResult
) {
  return function useRecipeIngredients(id: string | null) {
    const { recipe, isLoading, error } = useRecipeQuery(id);

    return {
      ingredients: (recipe?.recipeIngredients.filter(
        (ingredient) => ingredient.systemUsed == recipe.systemUsed
      ) ?? []) as RecipeIngredientsDto[],
      isLoading,
      error,
    };
  };
}
