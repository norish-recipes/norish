"use client";

import { createRecipeFiltersContext } from "@norish/shared-react/contexts";

import {
  RECIPE_FILTERS_STORAGE_KEY,
  webRecipeFiltersStorageAdapter,
} from "@/hooks/recipes/recipe-filters-storage-adapter";


const sharedRecipeFiltersContext = createRecipeFiltersContext({
  storageAdapter: webRecipeFiltersStorageAdapter,
  storageKey: RECIPE_FILTERS_STORAGE_KEY,
});

export const RecipesFiltersProvider = sharedRecipeFiltersContext.RecipeFiltersProvider;
export const useRecipesFiltersContext = sharedRecipeFiltersContext.useRecipeFiltersContext;

export type { CanonicalRecipeFilters as RecipeFilters } from "@norish/shared-react/contexts";
