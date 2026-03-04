import { createUseRecipeAutocomplete } from "./use-recipe-autocomplete";
import { createUsePendingRecipesQuery } from "./use-pending-recipes-query";
import { createUseRandomRecipe } from "./use-random-recipe";
import { createUseRecipesCacheHelpers } from "./use-recipes-cache";
import { createUseRecipesMutations } from "./use-recipes-mutations";
import { createUseRecipesQuery } from "./use-recipes-query";
import { createUseRecipesSubscription } from "./use-recipes-subscription";

import type { CreateRecipeHooksOptions } from "../types";

export type {
  InfiniteRecipeData,
  RecipesCacheHelpers,
} from "./use-recipes-cache";
export type { RecipeFilters, RecipesQueryResult, RecipesQueryDependencies } from "./use-recipes-query";
export type { RandomRecipeResult } from "./use-random-recipe";
export type { RecipesMutationsResult, RecipesMutationErrorHandler } from "./use-recipes-mutations";
export type { RecipesSubscriptionCallbacks } from "./use-recipes-subscription";
export type { RecipeFiltersStorageAdapter } from "./recipe-filters-storage-adapter";

export {
  createUsePendingRecipesQuery,
  createUseRecipesCacheHelpers,
  createUseRecipesQuery,
  createUseRecipesMutations,
  createUseRecipesSubscription,
  createUseRecipeAutocomplete,
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
    useRecipesQuery,
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
    useRecipeAutocomplete: createUseRecipeAutocomplete(options),
    useRandomRecipe: createUseRandomRecipe(options),
  };
}
