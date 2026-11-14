import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LibraryGridItem } from "@norish/shared-react/recipes";
import {
  libraryGridItems,
  useLibraryFilters,
  useLibraryList,
  usePendingRecipesQuery,
} from "@norish/shared-react/recipes";

import type { CardContext } from "./library-cards";
import { AccountAvatar } from "./account-avatar";
import { CookbookCard } from "./cookbook-card";
import { LibraryCards } from "./library-cards";
import { LibraryHeader } from "./library-header";
import { CookbooksEmpty, LibraryEmpty } from "./library-states";
import { PendingCard } from "./pending-card";
import { RecipeCard } from "./recipe-card";

/** The Recipes tab: `title` and the avatar, `header` (Today), then imports, recipes and cookbooks
 * as one paged list; the title and avatar are list content, so they scroll away with it. */
export function LibraryList({
  title,
  header,
  testID,
}: {
  title: string;
  header?: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const filters = useLibraryFilters((state) => state.filters);
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
      header={
        <>
          <View
            className="flex-row items-center justify-between px-5"
            style={{ paddingTop: insets.top + 6 }}
          >
            <Text
              accessibilityRole="header"
              className="text-foreground text-[34px] leading-[41px] font-semibold tracking-[-0.75px]"
              testID="large-title"
            >
              {title}
            </Text>
            <AccountAvatar />
          </View>
          {header}
          <LibraryHeader />
        </>
      }
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
