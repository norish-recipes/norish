import type { ReactNode } from "react";
import React, { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Spinner } from "heroui-native";

import type { LibraryGridItem } from "@norish/shared-react/recipes";
import { useDevicePreference } from "@norish/shared-react/reader";
import {
  libraryGridItems,
  useLibraryCards,
  useLibraryFilters,
  useLibraryList,
  usePendingRecipesQuery,
} from "@norish/shared-react/recipes";
import { hasAppliedRecipeFilters } from "@norish/shared/contracts/filter-contract";

import { useCardActions } from "../hooks/use-card-actions";
import { CookbookCard } from "./cookbook-card";
import { LibraryHeader } from "./library-header";
import { LibrarySkeleton } from "./library-skeleton";
import { CookbooksEmpty, LibraryEmpty, LibraryNoResults } from "./library-states";
import { PendingCard } from "./pending-card";
import { RecipeCard } from "./recipe-card";

/** The tab bar's Add recipe accessory floats over the list's end, so the last row scrolls clear of it. */
const ACCESSORY_CLEARANCE = 72;
/** UIKit no longer insets the list for the tab bar, so its 49 pt is added here. */
const TAB_BAR = 49;

/** Scrolled this far (the title's 6 pt offset and 41 pt line, less a margin), the header shows the title. */
const TITLE_SCROLLED_AT = 40;

/**
 * The Recipes tab's scroll view: the large `title` on the avatar's band, `header` (Today) below it,
 * then the Library, whose rows are the running imports, recipes and cookbooks as one list, paged as
 * the reader scrolls. Once the title has scrolled away the native header shows it inline.
 */
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
  const [titleScrolled, setTitleScrolled] = useState(false);
  const [variant] = useDevicePreference("recipeViewMode");
  const filters = useLibraryFilters((state) => state.filters);
  const clearFilters = useLibraryFilters((state) => state.clearFilters);
  const { isFavorite, allergies } = useLibraryCards();
  const actions = useCardActions();
  const { pendingRecipes, pendingRecipeIds } = usePendingRecipesQuery();
  const { items, isLoading, isFetchingNextPage, loadMore } = useLibraryList();
  const rows = libraryGridItems(items, pendingRecipeIds, filters.libraryType);
  const hasAppliedFilters = hasAppliedRecipeFilters(filters);
  const isGrid = variant === "grid";

  const renderRow = ({ item }: { item: LibraryGridItem }) => {
    const card =
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

    return isGrid ? card : <View className="px-5 pb-3">{card}</View>;
  };

  const empty = isLoading ? (
    <LibrarySkeleton variant={variant} />
  ) : filters.libraryType === "cookbooks" && !hasAppliedFilters ? (
    <CookbooksEmpty />
  ) : hasAppliedFilters ? (
    <LibraryNoResults onClear={clearFilters} />
  ) : (
    <LibraryEmpty />
  );

  return (
    // Remounted per view: a FlatList's column count can't change under it.
    <FlatList
      key={variant}
      ListEmptyComponent={empty}
      ListFooterComponent={isFetchingNextPage ? <Spinner className="py-4" /> : undefined}
      ListHeaderComponent={
        <>
          <Stack.Screen options={{ title: titleScrolled ? title : "" }} />
          <Text
            className="text-foreground px-5 text-[34px] leading-[41px] font-semibold tracking-[-0.75px]"
            style={{ paddingTop: insets.top + 6 }}
            testID="large-title"
          >
            {title}
          </Text>
          {header}
          <LibraryHeader />
        </>
      }
      columnWrapperStyle={isGrid ? { gap: 12, paddingHorizontal: 20, marginBottom: 12 } : undefined}
      contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR + ACCESSORY_CLEARANCE }}
      contentInsetAdjustmentBehavior="never"
      data={isLoading ? [] : rows}
      keyExtractor={(row) => `${row.kind}-${row.id}`}
      numColumns={isGrid ? 2 : 1}
      renderItem={renderRow}
      scrollEventThrottle={16}
      style={{ flex: 1 }}
      testID={testID}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      onScroll={({ nativeEvent }) =>
        setTitleScrolled(nativeEvent.contentOffset.y > TITLE_SCROLLED_AT)
      }
    />
  );
}
