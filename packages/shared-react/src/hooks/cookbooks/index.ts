import type { CreateRecipeHooksOptions } from "../recipes/types";
import {
  useCookbookMemberIdsQuery,
  useCookbookQuery,
  useCookbookRecipesQuery,
  useCookbooksCacheHelpers,
  useCookbooksMutations,
  useCookbooksQuery,
  useCookbooksSubscription,
  useEditableCookbooksQuery,
  useRecipeCookbooksQuery,
} from "../../recipes";

export type {
  CookbookFilters,
  CookbookMemberIdsQueryResult,
  CookbookQueryResult,
  CookbookRecipesQueryResult,
  CookbooksCacheHelpers,
  CookbooksMutationsResult,
  CookbooksQueryResult,
  EditableCookbook,
  EditableCookbooksQueryResult,
  InfiniteCookbookData,
  RecipeCookbooksQueryResult,
} from "../../recipes";

export function createCookbookHooks(_options: CreateRecipeHooksOptions) {
  return {
    useCookbooksCacheHelpers,
    useCookbookQuery,
    useCookbookMemberIdsQuery,
    useCookbookRecipesQuery,
    useRecipeCookbooksQuery,
    useEditableCookbooksQuery,
    useCookbooksQuery,
    useCookbooksMutations,
    useCookbooksSubscription,
  };
}
