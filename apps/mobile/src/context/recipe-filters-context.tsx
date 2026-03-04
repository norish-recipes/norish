import { createRecipeFiltersContext } from '@norish/shared-react/contexts';

import {
  mobileRecipeFiltersStorageAdapter,
  RECIPE_FILTERS_STORAGE_KEY,
} from '@/hooks/recipes/recipe-filters-storage-adapter';

const recipeFiltersContext = createRecipeFiltersContext({
  storageAdapter: mobileRecipeFiltersStorageAdapter,
  storageKey: RECIPE_FILTERS_STORAGE_KEY,
});

export const RecipeFiltersProvider = recipeFiltersContext.RecipeFiltersProvider;
export const useRecipeFiltersContext = recipeFiltersContext.useRecipeFiltersContext;
