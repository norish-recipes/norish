"use client";

import type { LibraryGridItem } from "@/lib/library-items";
import RecipeSelectionBar from "@/components/dashboard/recipe-selection-bar";
import { useLibraryCards, useLibraryQueryFilters } from "@/hooks/use-library";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { SelectedRecipe } from "@norish/shared-react/recipes";
import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import {
  useCookbookRecipesQuery,
  useCookbooksMutations,
  useRecipeSelection,
} from "@norish/shared-react/recipes";
import {
  hasAppliedRecipeFilters,
  serializeRecipeFilters,
} from "@norish/shared/contracts/filter-contract";

import LibraryGrid from "./library-grid";
import RecipeCard from "./recipe-card";

/** The selection bar over a cookbook's members, whose versions it acts on. */
export function CookbookSelectionBar({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const { queryFilters, isHydrated } = useLibraryQueryFilters();
  const { recipes, removeMember } = useCookbookRecipesQuery(cookbook.id, queryFilters, {
    enabled: isHydrated,
  });

  return (
    <RecipeSelectionBar
      cookbook={cookbook}
      recipes={recipes}
      onLeave={(recipeIds) => {
        for (const recipeId of recipeIds) removeMember(recipeId);
      }}
    />
  );
}

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
  variant: RecipeViewMode;
}) {
  const t = useTranslations("recipes.cookbooks");
  const { filters, queryFilters, isHydrated } = useLibraryQueryFilters();
  const { isFavorite, toggleFavorite, deleteRecipes, allergies } = useLibraryCards();
  const { setMembership } = useCookbooksMutations();
  const selectRange = useRecipeSelection((state) => state.selectRange);

  // Wait for the stored filters, as the Library does: asking under the defaults first shows members
  // the reader filters out, then asks again.
  const { recipes, isLoading, isValidating, loadMore, removeMember } = useCookbookRecipesQuery(
    cookbookId,
    queryFilters,
    { enabled: isHydrated }
  );

  const selectRangeTo = (recipe: SelectedRecipe) => selectRange(recipe, recipes);

  const items: LibraryGridItem[] = recipes.map((recipe) => ({
    kind: "recipe" as const,
    id: recipe.id,
    recipe,
  }));

  // Taking a recipe out of the cookbook it is being read in, from the card's
  // swipe actions. The member list is this cookbook's own read, so drop the
  // row now rather than waiting for a refetch that Offline never comes.
  const removeFromCookbook = (recipeId: string) => {
    setMembership({ cookbookId, recipeIds: [recipeId], isMember: false });
    removeMember(recipeId);
  };

  const renderItem = (item: LibraryGridItem) => {
    if (item.kind !== "recipe") return null;

    return (
      <RecipeCard
        allergies={allergies}
        isFavorite={isFavorite(item.recipe.id)}
        recipe={item.recipe}
        variant={variant}
        onDelete={deleteRecipes}
        onRemoveFromCookbook={removeFromCookbook}
        onSelectRange={selectRangeTo}
        onToggleFavorite={toggleFavorite}
      />
    );
  };

  // The contract's own predicate, so "no matches" here means what it means on
  // the Library rather than a second opinion that drifts from it.
  const hasNarrowingFilters = hasAppliedRecipeFilters(filters);

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
      isLoading={isLoading || !isHydrated}
      items={items}
      loadMore={loadMore}
      renderItem={renderItem}
      // Scroll position is remembered per cookbook and per set of filters.
      scrollKey={`cookbook:${cookbookId}:${serializeRecipeFilters(filters)}`}
      variant={variant}
    />
  );
}
