"use client";

import { useRecipesFiltersContext } from "@/context/recipes-filters-context";

export type { CanonicalRecipeFilters as RecipeFilters } from "@norish/shared/contracts/filter-contract";

export type UseRecipeFiltersResult = ReturnType<typeof useRecipesFiltersContext>;

export function useRecipeFilters(): UseRecipeFiltersResult {
  return useRecipesFiltersContext();
}
