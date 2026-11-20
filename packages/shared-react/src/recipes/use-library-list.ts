"use client";

import type { LibraryMatchDTO } from "@norish/shared/contracts";
import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { toRecipesQueryFilters } from "@norish/shared/contracts/filter-contract";

import type { RecipesMutationErrorHandler } from "./recipes-mutation-error";
import { useActiveAllergies } from "../reader";
import { useLibraryFilters } from "./library-filters-store";
import { useCookbookRecipesQuery } from "./use-cookbook-recipes-query";
import { useFavoritesMutation } from "./use-favorites-mutation";
import { useFavoritesQuery } from "./use-favorites-query";
import { useLibraryQuery } from "./use-library-query";
import { useRecipesMutations } from "./use-recipes-mutations";

/** The Library's filters, as a list query takes them, and whether the stored ones are applied. */
export function useLibraryQueryFilters(override?: CanonicalRecipeFilters) {
  const stored = useLibraryFilters((state) => state.filters);
  const filters = override ?? stored;
  const isHydrated = useLibraryFilters((state) => state.hydrated);

  return { filters, queryFilters: toRecipesQueryFilters(filters), isHydrated };
}

/** The Library under the reader's filters, in grid order; loading until they apply. `sortBeatsRank`,
 * `withMatch` (`matches` by recipe id), `limit`, `filters` and `enabled` (false reads nothing) are Search's. */
export function useLibraryList({
  sortBeatsRank,
  withMatch,
  limit,
  enabled = true,
  filters,
}: {
  sortBeatsRank?: boolean;
  withMatch?: boolean;
  limit?: number;
  enabled?: boolean;
  filters?: CanonicalRecipeFilters;
} = {}) {
  const { queryFilters, isHydrated } = useLibraryQueryFilters(filters);
  const library = useLibraryQuery(
    { ...queryFilters, sortBeatsRank, withMatch, limit },
    { enabled: isHydrated && enabled }
  );

  return {
    ...library,
    isLoading: library.isLoading || !isHydrated,
    recipes: library.items.flatMap((item) => (item.kind === "recipe" ? [item.recipe] : [])),
    matches: Object.fromEntries(
      library.items.flatMap((item) =>
        item.kind === "recipe" && item.match ? [[item.recipe.id, item.match] as const] : []
      )
    ) as Record<string, LibraryMatchDTO>,
  };
}

/** A cookbook's members under the reader's filters, loading until the stored filters apply. */
export function useCookbookList(cookbookId: string) {
  const { queryFilters, isHydrated } = useLibraryQueryFilters();
  const members = useCookbookRecipesQuery(cookbookId, queryFilters, { enabled: isHydrated });

  return { ...members, isLoading: members.isLoading || !isHydrated };
}

/** What a Library card is drawn and acted on with: favourites, the reader's allergies, delete. */
export function useLibraryCards(onMutationError?: RecipesMutationErrorHandler) {
  const { isFavorite } = useFavoritesQuery();
  const { toggleFavorite } = useFavoritesMutation();
  const { deleteRecipes } = useRecipesMutations(onMutationError);
  const { allergies } = useActiveAllergies();

  return { isFavorite, toggleFavorite, deleteRecipes, allergies };
}
