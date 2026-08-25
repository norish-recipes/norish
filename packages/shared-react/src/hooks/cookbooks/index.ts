import type { CreateCookbookHooksOptions } from "./types";
import { createUseCookbookQuery } from "./use-cookbook-query";
import { createUseCookbooksCache } from "./use-cookbooks-cache";
import { createUseCookbooksMutations } from "./use-cookbooks-mutations";
import { createUseCookbooksQuery } from "./use-cookbooks-query";
import { createUseCookbooksSubscription } from "./use-cookbooks-subscription";

export type {
  CookbookFilters,
  CookbooksCacheHelpers,
  CookbooksMutationsResult,
  CookbooksQueryResult,
  CreateCookbookHooksOptions,
  InfiniteCookbookData,
} from "./types";

export type { CookbookQueryResult } from "./use-cookbook-query";

export {
  createUseCookbookQuery,
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
    useCookbooksQuery: createUseCookbooksQuery(options),
    useCookbooksMutations: createUseCookbooksMutations({ ...options, useCookbooksCacheHelpers }),
    useCookbooksSubscription: createUseCookbooksSubscription({
      ...options,
      useCookbooksCacheHelpers,
    }),
  };
}
