import type { CreateRecipeHooksOptions } from "../types";
import { createUseFavoritesMutation } from "./use-favorites-mutation";
import { createUseFavoritesQuery } from "./use-favorites-query";
import { createUsePendingRecipesQuery } from "./use-pending-recipes-query";
import { createUseRandomRecipe } from "./use-random-recipe";
import { createUseRatingsSubscription } from "./use-ratings-subscription";
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
export type { FavoritesQueryResult } from "./use-favorites-query";
export type { FavoritesMutationResult } from "./use-favorites-mutation";
export type { RatingsSubscriptionCallbacks } from "./use-ratings-subscription";
export type { RecipeFiltersStorageAdapter } from "./recipe-filters-storage-adapter";

export {
  createUsePendingRecipesQuery,
  createUseRecipesCacheHelpers,
  createUseRecipesQuery,
  createUseRecipesMutations,
  createUseRecipesSubscription,
  createUseRecipeAutocomplete,
  createUseFavoritesQuery,
  createUseFavoritesMutation,
  createUseRatingsSubscription,
  createUseRandomRecipe,
};

export function createDashboardRecipeHooks(
  options: CreateRecipeHooksOptions,
  dependencies: Pick<
    import("./use-recipes-query").RecipesQueryDependencies,
    "useAutoTaggingQuery" | "useAllergyDetectionQuery"
  >
) {
  const usePendingRecipesQuery = createUsePendingRecipesQuery(options);
  const useRecipesCacheHelpers = createUseRecipesCacheHelpers(options);
  const useRecipesQuery = createUseRecipesQuery(options, {
    usePendingRecipesQuery,
    useRecipesCacheHelpers,
    useAutoTaggingQuery: dependencies.useAutoTaggingQuery,
    useAllergyDetectionQuery: dependencies.useAllergyDetectionQuery,
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
    useFavoritesQuery: createUseFavoritesQuery(options),
    useFavoritesMutation: createUseFavoritesMutation(options),
    useRatingsSubscription: createUseRatingsSubscription(options),
    useRecipeAutocomplete: createUseRecipeAutocomplete(options),
    useRandomRecipe: createUseRandomRecipe(options),
  };
}
