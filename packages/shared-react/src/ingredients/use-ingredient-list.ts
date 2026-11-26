"use client";

import type { IngredientFilters } from "./ingredient-filters";
import { hasIngredientFilters } from "./ingredient-filters";
import { useIngredientListQuery } from "./use-ingredient-query";
import { useIngredientTree } from "./use-ingredient-tree";

/** The Ingredients list for a search and filters: a tree of kinds unless searched or filtered, else flat. */
export function useIngredientList(search: string, filters: IngredientFilters, locale: string) {
  // A search or filter may match at any depth, so only the unfiltered list is a tree of roots.
  const { tree: asTree, ...searchFilters } = filters;
  const treeMode = asTree && !search && !hasIngredientFilters({ ...searchFilters, tree: true });
  const list = useIngredientListQuery({
    search: search || undefined,
    ...searchFilters,
    rootsOnly: treeMode || undefined,
    locale,
  });
  const tree = useIngredientTree(list.items, treeMode, locale);

  return { ...list, treeMode, tree };
}
