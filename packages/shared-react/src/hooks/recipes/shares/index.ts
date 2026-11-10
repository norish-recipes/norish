import type { CreateRecipeHooksOptions } from "../types";
import {
  useAdminRecipeSharesQuery,
  useMyRecipeSharesQuery,
  useRecipeShareCacheHelpers,
  useRecipeShareMutations,
  useRecipeShareQuery,
  useRecipeSharesQuery,
  useRecipeShareSubscription,
  useSharedRecipeQuery,
} from "../../../recipes";

export type {
  AdminRecipeSharesQueryResult,
  MyRecipeSharesQueryResult,
  RecipeShareCacheHelpers,
  RecipeShareMutationsResult,
  RecipeShareQueryResult,
  RecipeSharesQueryResult,
  RecipeShareSubscriptionCallbacks,
  SharedRecipeQueryResult,
} from "../../../recipes";

export function createRecipeShareHooks(_options: CreateRecipeHooksOptions) {
  return {
    useRecipeSharesQuery,
    useMyRecipeSharesQuery,
    useAdminRecipeSharesQuery,
    useRecipeShareQuery,
    useRecipeShareMutations,
    useRecipeShareCacheHelpers,
    useRecipeShareSubscription,
    useSharedRecipeQuery,
  };
}
