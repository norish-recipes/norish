import type { TabScroll } from "@/lib/use-tab-scroll";
import type { ComponentType, ReactElement } from "react";
import React from "react";
import { View } from "react-native";
import { useTabScroll } from "@/lib/use-tab-scroll";
import { Stack } from "expo-router";
import { useIntl } from "react-intl";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import { useLibraryList } from "@norish/shared-react/recipes";

import { useSearchField } from "../hooks/use-search-field";
import { useSearchConfirmed } from "../utils/search-session";
import { searchView } from "../utils/search-state";

/** What the card list Search shows its results in takes: the recipes, paged, under `header`. */
export type SearchResultsProps = {
  recipes: RecipeDashboardDTO[];
  header: ReactElement;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  scroll: TabScroll;
  testID?: string;
};

/** Search: the field in the tab bar, and Results once confirmed. The other states come with later tickets.
 * `Results` is the Recipes feature's card list, which the route file hands in. */
export function SearchScreen({ Results }: { Results: ComponentType<SearchResultsProps> }) {
  const intl = useIntl();
  const [barRef, field] = useSearchField();
  const confirmed = useSearchConfirmed();
  const scroll = useTabScroll();
  // Recipes only, and an explicit sort beats rank; nothing is read until a search is confirmed.
  const list = useLibraryList({ sortBeatsRank: true, enabled: confirmed });
  const view = searchView({
    text: field.text,
    confirmed,
    focused: field.focused,
    resultCount: list.isLoading ? null : list.recipes.length,
  });

  return (
    <>
      <Stack.SearchBar
        ref={barRef}
        placeholder={intl.formatMessage({ id: "recipes.dashboard.searchRecipesPlaceholder" })}
        placement="automatic"
        onBlur={field.onBlur}
        onCancelButtonPress={field.onCancelButtonPress}
        onChangeText={field.onChangeText}
        onFocus={field.onFocus}
        onSearchButtonPress={field.onSearchButtonPress}
      />
      {view === "results" || view === "none" ? (
        <Results
          header={<View />}
          isFetchingNextPage={list.isFetchingNextPage}
          isLoading={list.isLoading}
          recipes={list.recipes}
          scroll={scroll}
          testID="search-results"
          onEndReached={list.loadMore}
        />
      ) : (
        <View className="bg-background flex-1" testID="search-screen" />
      )}
    </>
  );
}
