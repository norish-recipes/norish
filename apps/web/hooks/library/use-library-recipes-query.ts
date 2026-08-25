"use client";

import { useCallback, useMemo } from "react";
import { useLibraryQuery } from "@/hooks/library/use-library-query";
import { usePendingRecipesQuery, useRecipesCacheHelpers } from "@/hooks/recipes";

import type { RecipeFilters, RecipesQueryResult } from "@norish/shared-react/hooks";

/**
 * The shared recipes context, sourced from the Library union.
 *
 * The dashboard reads one list for both kinds (ADR-0026), so the context that
 * supplies favourites, allergies, pending imports and the recipe mutations is
 * pointed at the same query rather than fetching `recipes.list` beside it.
 * Both callers pass the same filters, so they share one cache entry and one
 * request.
 *
 * `total` counts both kinds, which is why nothing may read it as a recipe
 * count — the floating pill says "items" for exactly this reason.
 */
export function useLibraryRecipesQuery(
  filters: RecipeFilters & { favoritesOnly?: boolean } = {},
  options: { enabled?: boolean } = {}
): RecipesQueryResult {
  const library = useLibraryQuery(filters, options);
  const { pendingRecipeIds } = usePendingRecipesQuery();
  const { addPendingRecipe, removePendingRecipe, setAllRecipesData, invalidate } =
    useRecipesCacheHelpers();

  const recipes = useMemo(
    () => library.items.flatMap((item) => (item.kind === "recipe" ? [item.recipe] : [])),
    [library.items]
  );

  return {
    recipes,
    total: library.total,
    isLoading: library.isLoading,
    isValidating: library.isValidating,
    hasMore: library.hasMore,
    error: library.error,
    queryKey: [],
    pendingRecipeIds,
    loadMore: library.loadMore,
    addPendingRecipe,
    removePendingRecipe,
    setRecipesData: setAllRecipesData,
    setAllRecipesData,
    invalidate: useCallback(async () => {
      invalidate();
    }, [invalidate]),
  };
}
