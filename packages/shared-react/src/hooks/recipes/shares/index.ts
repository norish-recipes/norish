import type { CreateRecipeHooksOptions } from "../types";
import {
  useAdminRecipeSharesQuery,
  useMyRecipeSharesQuery,
  useRecipeShareCacheHelpers,
  useRecipeShareMutations,
  useRecipeSharesQuery,
  useRecipeShareSubscription,
  useSharedRecipeQuery,
} from "../../../recipes";

export type {
  AdminRecipeSharesQueryResult,
  MyRecipeSharesQueryResult,
  RecipeShareCacheHelpers,
  RecipeShareMutationsResult,
  RecipeSharesQueryResult,
  RecipeShareSubscriptionCallbacks,
  SharedRecipeQueryResult,
} from "../../../recipes";

export function createRecipeShareHooks(_options: CreateRecipeHooksOptions) {
  return {
    useRecipeSharesQuery,
    useMyRecipeSharesQuery,
    useAdminRecipeSharesQuery,
    useRecipeShareMutations,
    useRecipeShareCacheHelpers,
    useRecipeShareSubscription,
    useSharedRecipeQuery,
  };
}
