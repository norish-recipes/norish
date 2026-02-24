"use client";

import { useRecipeQuery } from "@/hooks/recipes/use-recipe-query";

import type { RecipeIngredientsDto } from "@norish/shared/contracts";

/**
 * Hook to fetch recipe ingredients using the tRPC recipes.get query.
 * This is a convenience wrapper for components that only need ingredients.
 */
export function useRecipeIngredients(id: string | null) {
  const { recipe, isLoading, error } = useRecipeQuery(id);

  return {
    ingredients: (recipe?.recipeIngredients.filter(
      (ingredient) => ingredient.systemUsed == recipe.systemUsed
    ) ?? []) as RecipeIngredientsDto[],
    isLoading,
    error,
  };
}
