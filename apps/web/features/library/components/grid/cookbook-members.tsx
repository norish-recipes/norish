"use client";

import { useRecipeMutationErrorToast } from "@/hooks/use-recipes-mutations";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { LibraryGridItem, SelectedRecipe } from "@norish/shared-react/recipes";
import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import {
  recipeGridItems,
  useCookbookList,
  useCookbooksMutations,
  useLibraryCards,
  useLibraryQueryFilters,
  useRecipeSelection,
} from "@norish/shared-react/recipes";
import {
  hasAppliedRecipeFilters,
  serializeRecipeFilters,
} from "@norish/shared/contracts/filter-contract";

import LibraryGrid from "./library-grid";
import RecipeCard from "./recipe-card";

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
  const { filters } = useLibraryQueryFilters();
  const { isFavorite, toggleFavorite, deleteRecipes, allergies } = useLibraryCards(
    useRecipeMutationErrorToast()
  );
  const { setMembership } = useCookbooksMutations();
  const selectRange = useRecipeSelection((state) => state.selectRange);

  const { recipes, isLoading, isFetching, isFetchingNextPage, loadMore, removeMember } =
    useCookbookList(cookbookId);

  const selectRangeTo = (recipe: SelectedRecipe) => selectRange(recipe, recipes);

  const items = recipeGridItems(recipes);

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
      isFetching={isFetching}
      isFetchingMore={isFetchingNextPage}
      isLoading={isLoading}
      items={items}
      loadMore={loadMore}
      renderItem={renderItem}
      // Scroll position is remembered per cookbook and per set of filters.
      scrollKey={`cookbook:${cookbookId}:${serializeRecipeFilters(filters)}`}
      variant={variant}
    />
  );
}
