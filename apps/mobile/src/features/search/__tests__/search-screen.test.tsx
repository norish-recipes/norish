// @vitest-environment jsdom
/** The screen draws what the state rule picks: the Offline card only for the "offline" view. */
import type { ReactNode } from "react";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

import { SearchScreen } from "../screens/search-screen";

const state = vi.hoisted(() => ({ view: "none" }));

vi.mock("react-native", () => ({ View: "div" }));
vi.mock("expo-router", () => ({ Stack: { SearchBar: () => null } }));
vi.mock("react-intl", () => ({ useIntl: () => ({ formatMessage: () => "", locale: "en" }) }));
vi.mock("@/components/filters-button", () => ({ FiltersButton: () => null }));
vi.mock("@/components/tab-root-header", () => ({ TabRootHeader: () => null }));
vi.mock("@/hooks/use-category-label", () => ({ useCategoryLabel: () => () => "" }));
vi.mock("@/lib/use-tab-scroll", () => ({ useTabScroll: () => ({ offset: 0 }) }));
vi.mock("@/lib/search-session", () => ({ useSearchConfirmed: () => true }));
vi.mock("@norish/shared-react/recipes", () => ({
  useLibraryFilters: () => () => {},
}));
vi.mock("../components/discover", () => ({ Discover: () => null }));
vi.mock("../components/typing-suggestions", () => ({ TypingSuggestions: () => null }));
vi.mock("../components/scope-row", () => ({ ScopeRow: () => null }));
vi.mock("../components/results-chrome", () => ({ ChipRow: () => null, RecipeCount: () => null }));
vi.mock("../components/no-results", () => ({
  SearchNoResults: () => <div data-testid="search-no-results" />,
  SearchOffline: () => <div data-testid="search-offline" />,
}));
vi.mock("../hooks/use-narrow-to", () => ({ useNarrowTo: () => () => {} }));
vi.mock("../hooks/use-search-field", () => ({
  useSearchField: () => [null, { text: "soup", focused: false }],
}));
vi.mock("../hooks/use-search-filters", () => ({
  useSearchFilters: () => ({ ...DEFAULT_RECIPE_FILTERS, rawInput: "soup" }),
}));
vi.mock("../hooks/use-typing-suggestions", () => ({
  useTypingSuggestions: () => ({ asked: "", loading: false, recipes: [], narrow: undefined }),
}));
vi.mock("../hooks/use-search-results", () => ({
  useSearchResults: () => ({
    view: state.view,
    loading: false,
    list: { recipes: [], matches: {}, total: 0, isFetchingNextPage: false, loadMore: () => {} },
  }),
}));

const Results = ({ noResults }: { noResults?: ReactNode }) => <div>{noResults}</div>;

describe("Search's empty card", () => {
  afterEach(cleanup);

  it("is the real no-results state when the rule says none", () => {
    state.view = "none";
    render(<SearchScreen Results={Results as never} />);

    expect(screen.getByTestId("search-no-results")).toBeTruthy();
    expect(screen.queryByTestId("search-offline")).toBeNull();
  });

  it("is the Offline card when the rule says offline", () => {
    state.view = "offline";
    render(<SearchScreen Results={Results as never} />);

    expect(screen.getByTestId("search-offline")).toBeTruthy();
    expect(screen.queryByTestId("search-no-results")).toBeNull();
  });
});
