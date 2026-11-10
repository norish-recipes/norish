import type { CreateRecipeHooksOptions } from "../types";
import { useFavoritesMutation, useFavoritesQuery, useRatingsSubscription } from "../../../recipes";
import { createUsePendingRecipesQuery } from "./use-pending-recipes-query";
import { createUseRandomRecipe } from "./use-random-recipe";
import { createUseRecipeAutocomplete } from "./use-recipe-autocomplete";
import { createUseRecipesCacheHelpers } from "./use-recipes-cache";
import { createUseRecipesMutations } from "./use-recipes-mutations";
import { createUseRecipesQuery } from "./use-recipes-query";
import { createUseRecipesSubscription } from "./use-recipes-subscription";

export type { InfiniteRecipeData, RecipesCacheHelpers } from "./use-recipes-cache";
export type {
  RecipeFilters,
  RecipesQueryResult,
  RecipesQueryDependencies,
} from "./use-recipes-query";
export type { RandomRecipeResult } from "./use-random-recipe";
export type { RecipesMutationsResult, RecipesMutationErrorHandler } from "./use-recipes-mutations";
export type { RecipesSubscriptionCallbacks } from "./use-recipes-subscription";
export type {
  FavoritesMutationResult,
  FavoritesQueryResult,
  RatingsSubscriptionCallbacks,
} from "../../../recipes";

export {
  createUsePendingRecipesQuery,
  createUseRecipesCacheHelpers,
  createUseRecipesQuery,
  createUseRecipesMutations,
  createUseRecipesSubscription,
  createUseRecipeAutocomplete,
  createUseRandomRecipe,
};

export function createDashboardRecipeHooks(options: CreateRecipeHooksOptions) {
  const usePendingRecipesQuery = createUsePendingRecipesQuery(options);
  const useRecipesCacheHelpers = createUseRecipesCacheHelpers(options);
  const useRecipesQuery = createUseRecipesQuery(options, {
    usePendingRecipesQuery,
    useRecipesCacheHelpers,
  });
  const useRecipesMutations = createUseRecipesMutations(options, {
    useRecipesCacheHelpers,
  });
  const useRecipesSubscription = createUseRecipesSubscription(options, {
    useRecipesCacheHelpers,
  });

  return {
    usePendingRecipesQuery,
    useRecipesCacheHelpers,
    useRecipesQuery,
    useRecipesMutations,
    useRecipesSubscription,
    useFavoritesQuery,
    useFavoritesMutation,
    useRatingsSubscription,
    useRecipeAutocomplete: createUseRecipeAutocomplete(options),
    useRandomRecipe: createUseRandomRecipe(options),
  };
}
