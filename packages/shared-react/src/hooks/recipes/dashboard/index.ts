import type { CreateRecipeHooksOptions } from "../types";
import {
  useFavoritesMutation,
  useFavoritesQuery,
  usePendingRecipesQuery,
  useRandomRecipe,
  useRatingsSubscription,
  useRecipeAutocomplete,
  useRecipesCacheHelpers,
  useRecipesMutations,
  useRecipesQuery,
  useRecipesSubscription,
} from "../../../recipes";

export type {
  FavoritesMutationResult,
  FavoritesQueryResult,
  InfiniteRecipeData,
  RandomRecipeResult,
  RatingsSubscriptionCallbacks,
  RecipeFilters,
  RecipesCacheHelpers,
  RecipesMutationErrorHandler,
  RecipesMutationsResult,
  RecipesQueryResult,
  RecipesSubscriptionCallbacks,
} from "../../../recipes";

export function createDashboardRecipeHooks(_options: CreateRecipeHooksOptions) {
  return {
    usePendingRecipesQuery,
    useRecipesCacheHelpers,
    useRecipesQuery,
    useRecipesMutations,
    useRecipesSubscription,
    useFavoritesQuery,
    useFavoritesMutation,
    useRatingsSubscription,
    useRecipeAutocomplete,
    useRandomRecipe,
  };
}
