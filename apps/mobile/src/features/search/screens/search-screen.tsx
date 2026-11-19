import type { HeaderItem } from "@/lib/header-item";
import type { TabScroll } from "@/lib/use-tab-scroll";
import type { ComponentType, ReactElement } from "react";
import React from "react";
import { Text, View } from "react-native";
import { GlassIconButton } from "@/components/glass";
import { TabRootHeader } from "@/components/tab-root-header";
import { useSearchConfirmed } from "@/lib/search-session";
import { useTabScroll } from "@/lib/use-tab-scroll";
import { Stack, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import { useLibraryFilters, useLibraryList } from "@norish/shared-react/recipes";

import { SearchNoResults } from "../components/no-results";
import { ChipRow, RecipeCount } from "../components/results-chrome";
import { ScopeRow } from "../components/scope-row";
import { useSearchField } from "../hooks/use-search-field";
import { filterChips } from "../utils/search-chips";
import { ALL_SCOPE, isScopeNarrowed } from "../utils/search-scope";
import { hasSearchFilters, noResultsVariant, searchView } from "../utils/search-state";

/** What the card list Search shows its results in takes: the recipes, paged, under `header`. */
export type SearchResultsProps = {
  recipes: RecipeDashboardDTO[];
  header: ReactElement;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  noResults: ReactElement;
  scroll: TabScroll;
  testID?: string;
};

/** The funnel: the Filters sheet over Search's filters, badged with how many are applied. */
function Funnel({ count }: { count: number }) {
  const intl = useIntl();
  const router = useRouter();
  const title = intl.formatMessage({ id: "common.filters.title" });
  const label =
    count > 0 ? intl.formatMessage({ id: "recipes.search.filtersOn" }, { count }) : title;

  return (
    <View>
      <GlassIconButton
        label={label}
        symbol="line.3.horizontal.decrease"
        testID="search-filters-button"
        onPress={() => router.push("/filters")}
      />
      {count > 0 ? (
        <View
          className="bg-accent absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full px-1"
          pointerEvents="none"
        >
          <Text className="text-accent-foreground text-[11px] font-semibold">{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Search: the field in the tab bar, its Search Scope while it has text, and Results once confirmed.
 * Suggestions and discover come with later tickets.
 * `Results` is the Recipes feature's card list, which the route file hands in. */
export function SearchScreen({ Results }: { Results: ComponentType<SearchResultsProps> }) {
  const intl = useIntl();
  const [barRef, field] = useSearchField();
  const confirmed = useSearchConfirmed();
  const scroll = useTabScroll();
  // Recipes only, and an explicit sort beats rank; nothing is read until a search is confirmed.
  const list = useLibraryList({ sortBeatsRank: true, enabled: confirmed });
  const filters = useLibraryFilters((state) => state.filters);
  const setFilters = useLibraryFilters((state) => state.setFilters);
  const clearFilters = useLibraryFilters((state) => state.clearFilters);
  const funnel: HeaderItem = {
    type: "custom",
    element: <Funnel count={filterChips(filters).length} />,
    hidesSharedBackground: true,
  };
  const view = searchView({
    text: field.text,
    confirmed,
    focused: field.focused,
    resultCount: list.isLoading ? null : list.recipes.length,
  });

  const noResults = (
    <SearchNoResults
      text={field.text.trim()}
      variant={noResultsVariant(hasSearchFilters(filters), isScopeNarrowed(filters.searchFields))}
      onClearFilters={clearFilters}
      onSearchAllFields={() => setFilters({ searchFields: [...ALL_SCOPE] })}
    />
  );
  const results = view === "results" || view === "none";

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
      {results ? (
        <Results
          header={
            <View className="pt-2">
              <ChipRow />
              {view === "results" && !list.isLoading ? <RecipeCount count={list.total} /> : null}
            </View>
          }
          isFetchingNextPage={list.isFetchingNextPage}
          isLoading={list.isLoading}
          noResults={noResults}
          recipes={list.recipes}
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
