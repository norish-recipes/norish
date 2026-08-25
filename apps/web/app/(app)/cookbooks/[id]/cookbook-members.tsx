"use client";

import type { LibraryGridItem } from "@/lib/library-items";
import type { RecipeDashboardViewMode } from "@/lib/recipe-view-mode";
import { useCallback, useMemo } from "react";
import LibraryGrid from "@/components/dashboard/library-grid";
import RecipeCard from "@/components/dashboard/recipe-card";
import { useRecipesContext } from "@/context/recipes-context";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useCookbookRecipesQuery, useCookbooksMutations } from "@/hooks/cookbooks";
import { MinusCircleIcon } from "@heroicons/react/20/solid";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import { toRecipesQueryFilters } from "@norish/shared-react/contexts";

/**
 * A cookbook's members, through the same grid the Library uses.
 *
 * The reader's own sort, search and Filters panel apply here, because the
 * members are read through the recipe list itself rather than a second query
 * with its own rules — which is what keeps a large cookbook usable.
 */
export default function CookbookMembers({
  cookbookId,
  variant,
}: {
  cookbookId: string;
  variant: RecipeDashboardViewMode;
}) {
  const t = useTranslations("recipes.cookbooks");
  const { filters } = useRecipesFiltersContext();
  const { isFavorite, toggleFavorite, deleteRecipe, allergies } = useRecipesContext();
  const { setMembership } = useCookbooksMutations();

  const queryFilters = useMemo(() => toRecipesQueryFilters(filters), [filters]);
  const { recipes, isLoading, isValidating, loadMore, removeMember } = useCookbookRecipesQuery(
    cookbookId,
    queryFilters
  );

  const items = useMemo<LibraryGridItem[]>(
    () => recipes.map((recipe) => ({ kind: "recipe" as const, id: recipe.id, recipe })),
    [recipes]
  );

  const renderItem = useCallback(
    (item: LibraryGridItem) => {
      if (item.kind !== "recipe") return null;

      return (
        <div className="relative">
          <RecipeCard
            allergies={allergies}
            isFavorite={isFavorite(item.recipe.id)}
            recipe={item.recipe}
            variant={variant}
            onDelete={deleteRecipe}
            onToggleFavorite={toggleFavorite}
          />
          {/* Taking a recipe out of the cookbook it is being read in. This
              never touches the recipe — only its membership (ADR-0027). */}
          <button
            aria-label={t("removeFromCookbook")}
            className="bg-overlay text-muted hover:text-danger shadow-surface absolute right-2 bottom-2 z-20 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            data-remove-from-cookbook={item.recipe.name}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMembership({ cookbookId, recipeId: item.recipe.id, isMember: false });
              // The member list is this cookbook's own read, so drop the row
              // now rather than waiting for a refetch that Offline never comes.
              removeMember(item.recipe.id);
            }}
          >
            <MinusCircleIcon className="h-5 w-5" />
          </button>
        </div>
      );
    },
    [allergies, isFavorite, deleteRecipe, toggleFavorite, variant, setMembership, cookbookId, t]
  );

  const hasNarrowingFilters =
    filters.rawInput.trim().length > 0 ||
    filters.searchTags.length > 0 ||
    filters.categories.length > 0 ||
    filters.minRating !== null ||
    filters.maxCookingTime !== null ||
    filters.showFavoritesOnly;

  const emptyState = (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <Card className="border-border bg-surface shadow-surface w-full max-w-xl border">
        <Card.Content className="flex flex-col items-center gap-3 p-8 text-center">
          <h2 className="text-base font-semibold">
            {hasNarrowingFilters ? t("noMatchingMembers") : t("empty")}
          </h2>
          {!hasNarrowingFilters && <p className="text-muted text-base">{t("emptyHint")}</p>}
        </Card.Content>
      </Card>
    </div>
  );

  return (
    <LibraryGrid
      emptyState={emptyState}
      isFetchingMore={isValidating && !isLoading}
      isLoading={isLoading}
      items={items}
      loadMore={loadMore}
      renderItem={renderItem}
      // Scroll position is remembered per cookbook and per set of filters.
      scrollKey={`cookbook:${cookbookId}:${JSON.stringify(queryFilters)}`}
      variant={variant}
    />
  );
}
