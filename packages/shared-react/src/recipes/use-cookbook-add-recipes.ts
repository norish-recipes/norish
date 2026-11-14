"use client";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import { useCookbookMemberIdsQuery } from "./use-cookbook-member-ids-query";
import { useCookbooksMutations } from "./use-cookbooks-mutations";
import { useRecipePick } from "./use-recipe-pick";

/** A search over the recipes a cookbook doesn't hold, a staged pick and one save; leaving members
 * out needs the whole cookbook's member ids, not a page of them. */
export function useCookbookAddRecipes(cookbook: CookbookSummaryDTO) {
  const { setMembership } = useCookbooksMutations();
  const { recipes, isLoading, ...pick } = useRecipePick();
  const { memberIds, isLoading: isLoadingMembers } = useCookbookMemberIdsQuery(cookbook.id);
  const members = new Set(memberIds);

  return {
    ...pick,
    /** The recipes the cookbook can still take. */
    addable: recipes.filter((recipe) => !members.has(recipe.id)),
    /** Whether the search found anything at all, held or not: it says why the list is empty. */
    hasRecipes: recipes.length > 0,
    isLoading: isLoading || isLoadingMembers,
    save: () =>
      setMembership({
        cookbookId: cookbook.id,
        recipeIds: pick.selected,
        isMember: true,
        cookbook,
      }),
  };
}
