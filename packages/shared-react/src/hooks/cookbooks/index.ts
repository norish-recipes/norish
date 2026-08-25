import type { CreateCookbookHooksOptions } from "./types";
import { createUseCookbookQuery } from "./use-cookbook-query";
import { createUseCookbookRecipesQuery } from "./use-cookbook-recipes-query";
import { createUseCookbooksCache } from "./use-cookbooks-cache";
import { createUseCookbooksMutations } from "./use-cookbooks-mutations";
import { createUseCookbooksQuery } from "./use-cookbooks-query";
import { createUseCookbooksSubscription } from "./use-cookbooks-subscription";
import {
  createUseEditableCookbooksQuery,
  createUseRecipeCookbooksQuery,
} from "./use-recipe-cookbooks-query";

export type {
  CookbookFilters,
  EditableCookbooksQueryResult,
  RecipeCookbooksQueryResult,
  CookbooksCacheHelpers,
  CookbooksMutationsResult,
  CookbooksQueryResult,
  CreateCookbookHooksOptions,
  InfiniteCookbookData,
} from "./types";

export type { CookbookQueryResult } from "./use-cookbook-query";
export type { CookbookRecipesQueryResult } from "./use-cookbook-recipes-query";

export {
  createUseCookbookQuery,
  createUseCookbookRecipesQuery,
  createUseEditableCookbooksQuery,
  createUseRecipeCookbooksQuery,
  createUseCookbooksCache,
  createUseCookbooksMutations,
  createUseCookbooksQuery,
  createUseCookbooksSubscription,
};

export function createCookbookHooks(options: CreateCookbookHooksOptions) {
  const useCookbooksCacheHelpers = createUseCookbooksCache(options);

  return {
    useCookbooksCacheHelpers,
    useCookbookQuery: createUseCookbookQuery(options),
    useCookbookRecipesQuery: createUseCookbookRecipesQuery(options),
    useRecipeCookbooksQuery: createUseRecipeCookbooksQuery(options),
    useEditableCookbooksQuery: createUseEditableCookbooksQuery(options),
    useCookbooksQuery: createUseCookbooksQuery(options),
    useCookbooksMutations: createUseCookbooksMutations({ ...options, useCookbooksCacheHelpers }),
    useCookbooksSubscription: createUseCookbooksSubscription({
      ...options,
      useCookbooksCacheHelpers,
    }),
  };
}
