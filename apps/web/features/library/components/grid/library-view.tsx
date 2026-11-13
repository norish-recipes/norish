"use client";

import { RecipeCardSkeleton } from "@/features/library/components/skeleton";

import type { LibraryGridItem, SelectedRecipe } from "@norish/shared-react/recipes";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import {
  libraryGridItems,
  useCookbooksMutations,
  useLibraryCards,
  useLibraryFilters,
  useLibraryList,
  usePendingRecipesQuery,
  useRecipeMutationErrorToast,
  useRecipeSelection,
} from "@norish/shared-react/recipes";
import {
  hasAppliedRecipeFilters,
  serializeRecipeFilters,
} from "@norish/shared/contracts/filter-contract";

import CookbookCard from "./cookbook-card";
import LibraryGrid from "./library-grid";
import NoCookbooksText from "./no-cookbooks-text";
import NoRecipeResults from "./no-recipe-results";
import NoRecipesText from "./no-recipes-text";
import RecipeCard from "./recipe-card";

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
  const filters = useLibraryFilters((state) => state.filters);
  const clearFilters = useLibraryFilters((state) => state.clearFilters);
  const { isFavorite, toggleFavorite, deleteRecipes, allergies } = useLibraryCards(
    useRecipeMutationErrorToast()
  );
  const { pendingRecipeIds } = usePendingRecipesQuery();
  const { deleteCookbook } = useCookbooksMutations();
  const isSelecting = useRecipeSelection((state) => state.selected.size > 0);
  const selectRange = useRecipeSelection((state) => state.selectRange);
  const { items, recipes, isLoading, isFetching, isFetchingNextPage, loadMore } = useLibraryList();
  const hasAppliedFilters = hasAppliedRecipeFilters(filters);
  const selectRangeTo = (recipe: SelectedRecipe) => selectRange(recipe, recipes);

  const gridItems = libraryGridItems(items, pendingRecipeIds, filters.libraryType);

  const renderItem = (item: LibraryGridItem) => {
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
        onSelectRange={selectRangeTo}
        onToggleFavorite={toggleFavorite}
      />
    );
  };

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
      isFetching={isFetching}
      isFetchingMore={isFetchingNextPage}
      isLoading={isLoading}
      items={gridItems}
      loadMore={loadMore}
      renderItem={renderItem}
      scrollKey={serializeRecipeFilters(filters)}
      variant={variant}
    />
  );
}
