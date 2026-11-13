"use client";

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
export function useLibraryQueryFilters() {
  const filters = useLibraryFilters((state) => state.filters);
  const isHydrated = useLibraryFilters((state) => state.hydrated);

  return { filters, queryFilters: toRecipesQueryFilters(filters), isHydrated };
}

/**
 * The Library under the reader's filters, with its recipes in grid order. Until the stored
 * filters are applied it stays loading: the defaults would show recipes the reader filters away.
 */
export function useLibraryList() {
  const { queryFilters, isHydrated } = useLibraryQueryFilters();
  const library = useLibraryQuery(queryFilters, { enabled: isHydrated });

  return {
    ...library,
    isLoading: library.isLoading || !isHydrated,
    recipes: library.items.flatMap((item) => (item.kind === "recipe" ? [item.recipe] : [])),
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
