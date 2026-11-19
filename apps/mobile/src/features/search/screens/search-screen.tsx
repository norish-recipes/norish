import type { HeaderItem } from "@/lib/header-item";
import type { RecipeResultsProps } from "@/lib/recipe-results-props";
import type { ComponentType } from "react";
import React from "react";
import { View } from "react-native";
import { FiltersButton } from "@/components/filters-button";
import { TabRootHeader } from "@/components/tab-root-header";
import { useSearchConfirmed } from "@/lib/search-session";
import { useTabScroll } from "@/lib/use-tab-scroll";
import { Stack } from "expo-router";
import { useIntl } from "react-intl";

import { useLibraryFilters, useLibraryList } from "@norish/shared-react/recipes";

import { SearchNoResults } from "../components/no-results";
import { ChipRow, RecipeCount } from "../components/results-chrome";
import { ScopeRow } from "../components/scope-row";
import { useSearchField } from "../hooks/use-search-field";
import { useSearchFilters } from "../hooks/use-search-filters";
import { filterChips } from "../utils/search-chips";
import { ALL_SCOPE, isScopeNarrowed } from "../utils/search-scope";
import { noResultsVariant, searchView, showsResults } from "../utils/search-state";

/** Search: the field in the tab bar, its Search Scope while it has text, and Results once confirmed.
 * `Results` is the Recipes feature's card list, which the route file hands in. */
export function SearchScreen({ Results }: { Results: ComponentType<RecipeResultsProps> }) {
  const intl = useIntl();
  const [barRef, field] = useSearchField();
  const scroll = useTabScroll();
  const confirmed = useSearchConfirmed();
  const filters = useSearchFilters();
  const chips = filterChips(filters);
  const setFilters = useLibraryFilters((state) => state.setFilters);
  const clearFilters = useLibraryFilters((state) => state.clearFilters);
  const input = {
    text: field.text,
    confirmed,
    hasChips: chips.length > 0,
    focused: field.focused,
  };
  // Recipes only, and an explicit sort beats rank; nothing is read until Results show.
  const list = useLibraryList({
    sortBeatsRank: true,
    withMatch: true,
    filters,
    enabled: showsResults({ ...input, resultCount: null }),
  });
  const view = searchView({ ...input, resultCount: list.isLoading ? null : list.recipes.length });
  const chipCount = chips.length;
  const funnel: HeaderItem = {
    type: "custom",
    element: (
      <FiltersButton
        count={chipCount}
        label={
          chipCount > 0
            ? intl.formatMessage({ id: "recipes.search.filtersOn" }, { count: chipCount })
            : intl.formatMessage({ id: "common.filters.title" })
        }
        testID="search-filters-button"
      />
    ),
    hidesSharedBackground: true,
  };

  const noResults = (
    <SearchNoResults
      text={field.text.trim()}
      variant={noResultsVariant(chips.length > 0, isScopeNarrowed(filters.searchFields))}
      onClearFilters={clearFilters}
      onSearchAllFields={() => setFilters({ searchFields: [...ALL_SCOPE] })}
    />
  );
  const showsList = view === "results" || view === "none";

  return (
    <>
      <TabRootHeader
        items={[funnel]}
        offset={scroll.offset}
        title={intl.formatMessage({ id: "common.actions.search" })}
      />
      <Stack.SearchBar
        ref={barRef}
        hideNavigationBar={false}
        placeholder={intl.formatMessage({ id: "recipes.dashboard.searchRecipesPlaceholder" })}
        placement="automatic"
        onBlur={field.onBlur}
        onCancelButtonPress={field.onCancelButtonPress}
        onChangeText={field.onChangeText}
        onClose={field.onClose}
        onFocus={field.onFocus}
        onOpen={field.onOpen}
        onSearchButtonPress={field.onSearchButtonPress}
      />
      {showsList ? (
        <Results
          header={
            <View className="pt-2">
              <ChipRow chips={chips} />
              {view === "results" && !list.isLoading ? <RecipeCount count={list.total} /> : null}
            </View>
          }
          isFetchingNextPage={list.isFetchingNextPage}
          isLoading={list.isLoading}
          matches={list.matches}
          noResults={noResults}
          recipes={list.recipes}
          search={filters.rawInput.trim()}
          scroll={scroll}
          testID="search-results"
          onEndReached={list.loadMore}
        />
      ) : (
        <View className="bg-background flex-1" testID="search-screen" />
      )}
      {field.text.trim() !== "" ? <ScopeRow /> : null}
    </>
  );
}
