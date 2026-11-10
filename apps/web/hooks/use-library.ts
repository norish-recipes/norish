"use client";

import { useRecipesMutations } from "@/hooks/use-recipes-mutations";

import { useActiveAllergies } from "@norish/shared-react/reader";
import {
  useFavoritesMutation,
  useFavoritesQuery,
  useLibraryFilters,
  useLibraryQuery,
} from "@norish/shared-react/recipes";
import { toRecipesQueryFilters } from "@norish/shared/contracts/filter-contract";

/**
 * The Library under the reader's filters, with its recipes in grid order. Until the stored
 * filters are applied it stays loading: the defaults would show recipes the reader filters away.
 */
export function useLibraryList() {
  const filters = useLibraryFilters((state) => state.filters);
  const isHydrated = useLibraryFilters((state) => state.hydrated);
  const library = useLibraryQuery(toRecipesQueryFilters(filters), { enabled: isHydrated });

  return {
    ...library,
    isLoading: library.isLoading || !isHydrated,
    recipes: library.items.flatMap((item) => (item.kind === "recipe" ? [item.recipe] : [])),
  };
}

/** What a Library card is drawn and acted on with: favourites, the reader's allergies, delete. */
export function useLibraryCards() {
  const { isFavorite } = useFavoritesQuery();
  const { toggleFavorite } = useFavoritesMutation();
  const { deleteRecipes } = useRecipesMutations();
  const { allergies } = useActiveAllergies();

  return { isFavorite, toggleFavorite, deleteRecipes, allergies };
}
