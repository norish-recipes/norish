"use client";

import type { LibraryGridItem } from "@/lib/library-items";
import { useCallback, useMemo } from "react";
import CookbookCard from "@/components/cookbooks/cookbook-card";
import LibraryGrid from "@/components/dashboard/library-grid";
import NoCookbooksText from "@/components/dashboard/no-cookbooks-text";
import NoRecipeResults from "@/components/dashboard/no-recipe-results";
import NoRecipesText from "@/components/dashboard/no-recipes-text";
import RecipeCard from "@/components/dashboard/recipe-card";
import RecipeCardSkeleton from "@/components/skeleton/recipe-card-skeleton";
import { useRecipeSelection } from "@/context/recipe-selection-context";
import { useRecipesContext } from "@/context/recipes-context";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useCookbooksMutations } from "@/hooks/cookbooks";
import { useLibraryQuery } from "@/hooks/library";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { toRecipesQueryFilters } from "@norish/shared/contracts/filter-contract";

/**
 * The Library's list: recipes and cookbooks interleaved, ordered by whatever
 * sort the reader chose, and paged as one list rather than two (ADR-0026).
 *
 * The type chip is a parameter of the query, so choosing Recipes or Cookbooks
 * narrows the union rather than slicing a page that was already fetched — and
 * the list's total counts both kinds, which is why nothing here reads it as a
 * recipe count.
 */
export default function LibraryView({ variant }: { variant: RecipeViewMode }) {
  const { filters, isHydrated } = useRecipesFiltersContext();
  const {
    pendingRecipeIds,
    hasAppliedFilters,
    clearFilters,
    filterKey,
    isFavorite,
    toggleFavorite,
    deleteRecipes,
    allergies,
  } = useRecipesContext();
  const { deleteCookbook } = useCookbooksMutations();
  const isSelecting = useRecipeSelection()?.isSelecting ?? false;

  // The same filters the context passes, so both share one cache entry and
  // one request.
  const queryFilters = useMemo(() => toRecipesQueryFilters(filters), [filters]);

  // Until the persisted filters are applied, the default filters are a guess,
  // so hold the loading presentation rather than painting a list the reader
  // had filtered away.
  const { items, isLoading, isValidating, loadMore } = useLibraryQuery(queryFilters, {
    enabled: isHydrated,
  });

  // A running import is a recipe on its way, so the Cookbooks lens leaves it out.
  const showsPending = filters.libraryType !== "cookbooks";

  const gridItems = useMemo<LibraryGridItem[]>(
    () => [
      ...(showsPending ? Array.from(pendingRecipeIds) : []).map((id) => ({
        kind: "pending" as const,
        id,
      })),
      ...items.map((item) =>
        item.kind === "recipe"
          ? { kind: "recipe" as const, id: item.recipe.id, recipe: item.recipe }
          : { kind: "cookbook" as const, id: item.cookbook.id, cookbook: item.cookbook }
      ),
    ],
    [showsPending, pendingRecipeIds, items]
  );

  const renderItem = useCallback(
    (item: LibraryGridItem) => {
      // A selection holds recipes only: cookbooks and imports still running
      // step back while it is open.
      if (item.kind !== "recipe") {
        return (
          <div
            className={isSelecting ? "opacity-40 transition-opacity" : "transition-opacity"}
            inert={isSelecting}
          >
            {item.kind === "pending" ? (
              <RecipeCardSkeleton variant={variant} />
            ) : (
              <CookbookCard
                allergies={allergies}
                cookbook={item.cookbook}
                variant={variant}
                onDelete={deleteCookbook}
              />
            )}
          </div>
        );
      }

      return (
        <RecipeCard
          allergies={allergies}
          isFavorite={isFavorite(item.recipe.id)}
          recipe={item.recipe}
          variant={variant}
          onDelete={deleteRecipes}
          onToggleFavorite={toggleFavorite}
        />
      );
    },
    [variant, allergies, isFavorite, deleteRecipes, toggleFavorite, deleteCookbook, isSelecting]
  );

  const emptyState =
    filters.libraryType === "cookbooks" && !hasAppliedFilters ? (
      <NoCookbooksText />
    ) : hasAppliedFilters ? (
      <NoRecipeResults onClear={clearFilters} />
    ) : (
      <NoRecipesText />
    );

  return (
    <LibraryGrid
      emptyState={emptyState}
      isFetchingMore={isValidating && !isLoading}
      isLoading={isLoading || !isHydrated}
      items={gridItems}
      loadMore={loadMore}
      renderItem={renderItem}
      scrollKey={filterKey}
      variant={variant}
    />
  );
}
