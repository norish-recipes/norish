"use client";

import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useRecipesMutations } from "@/hooks/use-recipes-mutations";

import type { RecipeFilters, RecipesQueryResult } from "@norish/shared-react/recipes";
import { createRecipesContext } from "@norish/shared-react/contexts";
import { usePlatform } from "@norish/shared-react/platform";
import { useActiveAllergies } from "@norish/shared-react/reader";
import {
  useFavoritesMutation,
  useFavoritesQuery,
  useLibraryQuery,
  usePendingRecipesQuery,
  useRatingsSubscription,
  useRecipesCacheHelpers,
  useRecipesSubscription,
} from "@norish/shared-react/recipes";

// The recipes out of the Library union (ADR-0026); both callers pass the same filters,
// so they share one cache entry. `total` counts both kinds.
function useLibraryRecipesQuery(
  filters: RecipeFilters & { favoritesOnly?: boolean } = {},
  options: { enabled?: boolean } = {}
): RecipesQueryResult {
  const library = useLibraryQuery(filters, options);
  const { pendingRecipeIds } = usePendingRecipesQuery();
  const { addPendingRecipe, removePendingRecipe, setAllRecipesData, invalidate } =
    useRecipesCacheHelpers();

  const recipes = library.items.flatMap((item) => (item.kind === "recipe" ? [item.recipe] : []));

  return {
    recipes,
    total: library.total,
    isLoading: library.isLoading,
    isValidating: library.isValidating,
    hasMore: library.hasMore,
    error: library.error,
    queryKey: library.queryKey,
    pendingRecipeIds,
    loadMore: library.loadMore,
    addPendingRecipe,
    removePendingRecipe,
    setRecipesData: setAllRecipesData,
    setAllRecipesData,
    invalidate: async () => {
      invalidate();
    },
  };
}

const sharedRecipesContext = createRecipesContext({
  useRecipesFiltersContext,
  useRecipesQuery: useLibraryRecipesQuery,
  useRecipesMutations,
  useFavoritesQuery,
  useFavoritesMutation,
  useActiveAllergies,
  useRecipesSubscription,
  useRatingsSubscription,
  useToastAdapter: () => usePlatform().toast,
  useNavigationAdapter: () => usePlatform().navigation,
});

export const RecipesContextProvider = sharedRecipesContext.RecipesProvider;
export const useRecipesContext = sharedRecipesContext.useRecipesContext;
