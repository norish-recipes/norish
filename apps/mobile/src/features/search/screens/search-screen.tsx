import type { HeaderItem } from "@/lib/header-item";
import type { RecipeResultsProps } from "@/lib/recipe-results-props";
import type { ComponentType } from "react";
import React from "react";
import { View } from "react-native";
import { FiltersButton } from "@/components/filters-button";
import { TabRootHeader } from "@/components/tab-root-header";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useSearchConfirmed } from "@/lib/search-session";
import { useTabScroll } from "@/lib/use-tab-scroll";
import { Stack } from "expo-router";
import { useIntl } from "react-intl";

import { useLibraryFilters } from "@norish/shared-react/recipes";

import { Discover } from "../components/discover";
import { SearchNoResults, SearchOffline } from "../components/no-results";
import { ChipRow, RecipeCount } from "../components/results-chrome";
import { ScopeRow } from "../components/scope-row";
import { TypingSuggestions } from "../components/typing-suggestions";
import { useNarrowTo } from "../hooks/use-narrow-to";
import { useSearchField } from "../hooks/use-search-field";
import { useSearchFilters } from "../hooks/use-search-filters";
import { useSearchResults } from "../hooks/use-search-results";
import { useTypingSuggestions } from "../hooks/use-typing-suggestions";
import { filterChips } from "../utils/search-chips";
import { ALL_SCOPE, isScopeNarrowed } from "../utils/search-scope";
import { noResultsVariant } from "../utils/search-state";
import { narrowRows } from "../utils/search-suggestions";

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
  const { list, view, loading } = useSearchResults({
    text: field.text,
    confirmed,
    hasChips: chips.length > 0,
    focused: field.focused,
  });
  const typing = useTypingSuggestions(field.text, view === "typing");
  const categoryLabel = useCategoryLabel();
  const rows = narrowRows(
    { suggestions: typing.narrow, locale: intl.locale, text: typing.asked, categoryLabel },
    filters
  );
  const narrowTo = useNarrowTo(field.narrowed);
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

  const noResults =
    view === "offline" ? (
      <SearchOffline />
    ) : (
      <SearchNoResults
        text={field.text.trim()}
        variant={noResultsVariant(chips.length > 0, isScopeNarrowed(filters.searchFields))}
        onClearFilters={clearFilters}
        onSearchAllFields={() => setFilters({ searchFields: [...ALL_SCOPE] })}
      />
    );
  const showsList = view === "results" || view === "none" || view === "offline";

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
              {view === "results" && !loading ? <RecipeCount count={list.total} /> : null}
            </View>
          }
          isFetchingNextPage={list.isFetchingNextPage}
          isLoading={loading}
          matches={{ byId: list.matches, search: filters.rawInput.trim() }}
          noResults={noResults}
          recipes={list.recipes}
          scroll={scroll}
          testID="search-results"
          onEndReached={list.loadMore}
        />
      ) : view === "typing" ? (
        <TypingSuggestions
          loading={typing.loading}
          narrowRows={rows}
          recipes={typing.recipes}
          searchWords={typing.asked}
          text={field.text}
          onConfirm={field.confirm}
          onNarrow={narrowTo}
        />
      ) : (
        <Discover
          focused={field.focused}
          onEdit={field.edit}
          onPicked={field.blur}
          onRun={field.run}
        />
      )}
      {field.text.trim() !== "" ? <ScopeRow /> : null}
    </>
  );
}
