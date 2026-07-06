import type { CreateRecipeHooksOptions } from "../types";
import { createUseRecipeShareCacheHelpers } from "./use-recipe-share-cache";
import { createUseRecipeShareMutations } from "./use-recipe-share-mutations";
import { createUseRecipeShareQuery } from "./use-recipe-share-query";
import { createUseRecipeShareSubscription } from "./use-recipe-share-subscription";
import {
  createUseAdminRecipeSharesQuery,
  createUseMyRecipeSharesQuery,
  createUseRecipeSharesQuery,
} from "./use-recipe-shares-query";
import { createUseSharedRecipeQuery } from "./use-shared-recipe-query";

export type { RecipeShareCacheHelpers } from "./use-recipe-share-cache";
export type { RecipeShareMutationsResult } from "./use-recipe-share-mutations";
export type { RecipeShareQueryResult } from "./use-recipe-share-query";
export type { RecipeShareSubscriptionCallbacks } from "./use-recipe-share-subscription";
export type {
  AdminRecipeSharesQueryResult,
  MyRecipeSharesQueryResult,
  RecipeSharesQueryResult,
} from "./use-recipe-shares-query";
export type { SharedRecipeQueryResult } from "./use-shared-recipe-query";

export {
  createUseRecipeShareCacheHelpers,
  createUseRecipeShareMutations,
  createUseRecipeShareQuery,
  createUseRecipeShareSubscription,
  createUseAdminRecipeSharesQuery,
  createUseMyRecipeSharesQuery,
  createUseRecipeSharesQuery,
  createUseSharedRecipeQuery,
};

export function createRecipeShareHooks(options: CreateRecipeHooksOptions) {
  const useRecipeShareCacheHelpers = createUseRecipeShareCacheHelpers(options);

  return {
    useRecipeSharesQuery: createUseRecipeSharesQuery(options),
    useMyRecipeSharesQuery: createUseMyRecipeSharesQuery(options),
    useAdminRecipeSharesQuery: createUseAdminRecipeSharesQuery(options),
    useRecipeShareQuery: createUseRecipeShareQuery(options),
    useRecipeShareMutations: createUseRecipeShareMutations(options, {
      useRecipeShareCacheHelpers,
    }),
    useRecipeShareCacheHelpers,
    useRecipeShareSubscription: createUseRecipeShareSubscription(options, {
      useRecipeShareCacheHelpers,
    }),
    useSharedRecipeQuery: createUseSharedRecipeQuery(options),
  };
}
