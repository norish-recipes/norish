"use client";

import type { LibraryGridItem } from "@/lib/library-items";
import type { RecipeDashboardViewMode } from "@/lib/recipe-view-mode";
import { useCallback, useMemo } from "react";
import CookbookCard from "@/components/cookbooks/cookbook-card";
import LibraryGrid from "@/components/dashboard/library-grid";
import NoCookbooksText from "@/components/dashboard/no-cookbooks-text";
import NoRecipeResults from "@/components/dashboard/no-recipe-results";
import NoRecipesText from "@/components/dashboard/no-recipes-text";
import RecipeCard from "@/components/dashboard/recipe-card";
import RecipeCardSkeleton from "@/components/skeleton/recipe-card-skeleton";
import { useRecipesContext } from "@/context/recipes-context";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useCookbooksMutations, useCookbooksQuery } from "@/hooks/cookbooks";

/**
 * The Library's list, for whichever type chip is lit.
 *
 * Recipes and cookbooks are drawn by one grid from one discriminated item
 * type, so the chips are a plain filter on what kind of thing is on screen
 * rather than a control that also rearranges the page (ADR-0026).
 */
export default function LibraryView({ variant }: { variant: RecipeDashboardViewMode }) {
  const { filters } = useRecipesFiltersContext();
  const showsCookbooks = filters.libraryType === "cookbooks";

  const {
    recipes,
    isLoading: isLoadingRecipes,
    isFetchingMore: isFetchingMoreRecipes,
    loadMore: loadMoreRecipes,
    pendingRecipeIds,
    hasAppliedFilters,
    clearFilters,
    filterKey,
    isFavorite,
    toggleFavorite,
    deleteRecipe,
    allergies,
  } = useRecipesContext();

  const {
    cookbooks,
    isLoading: isLoadingCookbooks,
    isValidating: isValidatingCookbooks,
    loadMore: loadMoreCookbooks,
  } = useCookbooksQuery(
    { search: filters.rawInput || undefined, sortMode: filters.sortMode },
    { enabled: showsCookbooks }
  );
  const { renameCookbook, deleteCookbook } = useCookbooksMutations();

  const items = useMemo<LibraryGridItem[]>(() => {
    if (showsCookbooks) {
      return cookbooks.map((cookbook) => ({ kind: "cookbook", id: cookbook.id, cookbook }));
    }

    return [
      ...Array.from(pendingRecipeIds).map((id) => ({ kind: "pending" as const, id })),
      ...recipes.map((recipe) => ({ kind: "recipe" as const, id: recipe.id, recipe })),
    ];
  }, [showsCookbooks, cookbooks, pendingRecipeIds, recipes]);

  const renderItem = useCallback(
    (item: LibraryGridItem) => {
      if (item.kind === "pending") {
        return <RecipeCardSkeleton variant={variant} />;
      }

      if (item.kind === "cookbook") {
        return (
          <CookbookCard
            cookbook={item.cookbook}
            variant={variant}
            onDelete={deleteCookbook}
            onRename={renameCookbook}
          />
        );
      }

      return (
        <RecipeCard
          allergies={allergies}
          isFavorite={isFavorite(item.recipe.id)}
          recipe={item.recipe}
          variant={variant}
          onDelete={deleteRecipe}
          onToggleFavorite={toggleFavorite}
        />
      );
    },
    [variant, allergies, isFavorite, deleteRecipe, toggleFavorite, deleteCookbook, renameCookbook]
  );

  const emptyState = showsCookbooks ? (
    <NoCookbooksText />
  ) : hasAppliedFilters ? (
    <NoRecipeResults onClear={clearFilters} />
  ) : (
    <NoRecipesText />
  );

  return (
    <LibraryGrid
      emptyState={emptyState}
      isFetchingMore={
        showsCookbooks ? isValidatingCookbooks && !isLoadingCookbooks : isFetchingMoreRecipes
      }
      isLoading={showsCookbooks ? isLoadingCookbooks : isLoadingRecipes}
      items={items}
      loadMore={showsCookbooks ? loadMoreCookbooks : loadMoreRecipes}
      renderItem={renderItem}
      scrollKey={filterKey}
      variant={variant}
    />
  );
}
