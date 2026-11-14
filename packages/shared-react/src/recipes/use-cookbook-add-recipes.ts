"use client";

import { useState, useTransition } from "react";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import { useCookbookMemberIdsQuery } from "./use-cookbook-member-ids-query";
import { useCookbooksMutations } from "./use-cookbooks-mutations";
import { useRecipesQuery } from "./use-recipes-query";

/** A search over the recipes a cookbook doesn't hold, a staged pick and one save; leaving members
 * out needs the whole cookbook's member ids, not a page of them. */
export function useCookbookAddRecipes(cookbook: CookbookSummaryDTO) {
  const { setMembership } = useCookbooksMutations();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const { recipes, isLoading, hasMore, loadMore } = useRecipesQuery({
    search: search || undefined,
  });
  const { memberIds, isLoading: isLoadingMembers } = useCookbookMemberIdsQuery(cookbook.id);
  const members = new Set(memberIds);

  return {
    input,
    /** Re-querying the whole recipe list is not work the keystroke waits on, so the field stays responsive. */
    setInput: (value: string) => {
      setInput(value);
      startTransition(() => setSearch(value.trim()));
    },
    /** The recipes the cookbook can still take. */
    addable: recipes.filter((recipe) => !members.has(recipe.id)),
    /** Whether the search found anything at all, held or not: it says why the list is empty. */
    hasRecipes: recipes.length > 0,
    isLoading: isLoading || isLoadingMembers,
    hasMore,
    loadMore,
    selected,
    toggle: (recipeId: string) =>
      setSelected((previous) =>
        previous.includes(recipeId)
          ? previous.filter((id) => id !== recipeId)
          : [...previous, recipeId]
      ),
    save: () =>
      setMembership({ cookbookId: cookbook.id, recipeIds: selected, isMember: true, cookbook }),
  };
}
