import type { ReactNode } from "react";
import React from "react";
import { TabRootHeader } from "@/components/tab-root-header";
import { useScrolled } from "@/lib/use-scrolled";

import type { LibraryGridItem } from "@norish/shared-react/recipes";
import {
  libraryGridItems,
  useLibraryFilters,
  useLibraryList,
  usePendingRecipesQuery,
} from "@norish/shared-react/recipes";

import type { CardContext } from "./library-cards";
import { CookbookCard } from "./cookbook-card";
import { LibraryCards } from "./library-cards";
import { LibraryHeader, useFiltersItem } from "./library-header";
import { CookbooksEmpty, LibraryEmpty } from "./library-states";
import { PendingCard } from "./pending-card";
import { RecipeCard } from "./recipe-card";

/** The fade over the Recipes tab's list: taller at rest than once scrolled. */
const LIST_FADE_HEIGHT = { rest: 190, scrolled: 120 };

/** The Recipes tab with its title on the bar's line, Filters and the avatar in the bar: `header`
 * (Today), then imports, recipes and cookbooks as one paged list. */
export function LibraryList({
  title,
  header,
  testID,
}: {
  title: string;
  header?: ReactNode;
  testID?: string;
}) {
  const filters = useLibraryFilters((state) => state.filters);
  const filtersItem = useFiltersItem();
  const { scrolled, onOffset } = useScrolled();
  const { pendingRecipes, pendingRecipeIds } = usePendingRecipesQuery();
  const { items, isLoading, isFetchingNextPage, loadMore } = useLibraryList();
  const rows = libraryGridItems(items, pendingRecipeIds, filters.libraryType);

  const renderCard = (
    item: LibraryGridItem,
    { variant, actions, allergies, isFavorite }: CardContext
  ) =>
    item.kind === "recipe" ? (
      <RecipeCard
        actions={actions}
        allergies={allergies}
        isFavorite={isFavorite(item.recipe.id)}
        recipe={item.recipe}
        variant={variant}
      />
    ) : item.kind === "cookbook" ? (
      <CookbookCard
        actions={actions}
        allergies={allergies}
        cookbook={item.cookbook}
        variant={variant}
      />
    ) : (
      <PendingCard
        id={item.id}
        url={pendingRecipes.find((pending) => pending.recipeId === item.id)?.url}
        variant={variant}
      />
    );

  return (
    <LibraryCards
      empty={filters.libraryType === "cookbooks" ? <CookbooksEmpty /> : <LibraryEmpty />}
      fadeHeight={LIST_FADE_HEIGHT}
      header={
        <>
          <TabRootHeader items={[filtersItem]} scrolled={scrolled} title={title} />
          {header}
          <LibraryHeader />
        </>
      }
      insets="automatic"
      onOffset={onOffset}
      isFetchingNextPage={isFetchingNextPage}
      isLoading={isLoading}
      renderCard={renderCard}
      rowKey={(row) => `${row.kind}-${row.id}`}
      rows={rows}
      testID={testID}
      onEndReached={loadMore}
    />
  );
}
