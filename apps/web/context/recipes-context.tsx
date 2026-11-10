"use client";

import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useFavoritesMutation, useFavoritesQuery } from "@/hooks/favorites";
import { useLibraryRecipesQuery } from "@/hooks/library";
import { useRecipesMutations } from "@/hooks/recipes";
import { sharedDashboardRecipeHooks } from "@/hooks/recipes/shared-recipe-hooks";

import { createRecipesContext } from "@norish/shared-react/contexts";
import { usePlatform } from "@norish/shared-react/platform";
import { useActiveAllergies } from "@norish/shared-react/reader";

const sharedRecipesContext = createRecipesContext({
  useRecipesFiltersContext,
  // The Library is one interleaved list, so the context's list comes from the
  // union rather than from `recipes.list` beside it (ADR-0026). `total` there
  // counts both kinds.
  useRecipesQuery: useLibraryRecipesQuery,
  useRecipesMutations,
  useFavoritesQuery,
  useFavoritesMutation,
  useActiveAllergies,
  useRecipesSubscription: sharedDashboardRecipeHooks.useRecipesSubscription,
  useRatingsSubscription: sharedDashboardRecipeHooks.useRatingsSubscription,
  useToastAdapter: () => usePlatform().toast,
  useNavigationAdapter: () => usePlatform().navigation,
});

export const RecipesContextProvider = sharedRecipesContext.RecipesProvider;
export const useRecipesContext = sharedRecipesContext.useRecipesContext;
