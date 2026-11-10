import type { CreateRecipeHooksOptions } from "../recipes/types";
import {
  useCookbookMemberIdsQuery,
  useCookbookQuery,
  useCookbookRecipesQuery,
  useCookbooksMutations,
  useCookbooksSubscription,
  useEditableCookbooksQuery,
  useRecipeCookbooksQuery,
} from "../../recipes";

export type {
  CookbookMemberIdsQueryResult,
  CookbookQueryResult,
  CookbookRecipesQueryResult,
  CookbooksMutationsResult,
  EditableCookbook,
  EditableCookbooksQueryResult,
  RecipeCookbooksQueryResult,
} from "../../recipes";

export function createCookbookHooks(_options: CreateRecipeHooksOptions) {
  return {
    useCookbookQuery,
    useCookbookMemberIdsQuery,
    useCookbookRecipesQuery,
    useRecipeCookbooksQuery,
    useEditableCookbooksQuery,
    useCookbooksMutations,
    useCookbooksSubscription,
  };
}
