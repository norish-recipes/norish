// @vitest-environment jsdom
/** The screen, through the real results hook and a real query client: what each case draws. */
import type { ReactNode } from "react";
import React from "react";
import { resetSearchSession, searchStore } from "@/lib/search-session";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOfflineQueryClient } from "@norish/shared-react/offline";
import { LibraryFiltersProvider } from "@norish/shared-react/recipes";

import { SearchScreen } from "../screens/search-screen";

const world = vi.hoisted(() => ({ offline: false, failing: false, items: [] as unknown[] }));

vi.mock("react-native", () => ({ View: "div" }));
vi.mock("expo-router", () => ({ Stack: { SearchBar: () => null } }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id, locale: "en" }),
}));
vi.mock("@/components/filters-button", () => ({ FiltersButton: () => null }));
vi.mock("@/components/tab-root-header", () => ({ TabRootHeader: () => null }));
vi.mock("@/hooks/use-category-label", () => ({ useCategoryLabel: () => () => "" }));
vi.mock("@/lib/use-tab-scroll", () => ({ useTabScroll: () => ({ offset: 0 }) }));
vi.mock("@/lib/search-session", async () => ({
  ...(await vi.importActual<object>("@/lib/search-session")),
  useSearchConfirmed: () => true,
}));
vi.mock("@norish/shared-react/offline/react", async () => ({
  ...(await vi.importActual<object>("@norish/shared-react/offline/react")),
  useConnectivity: () => ({ isOffline: world.offline }),
}));
vi.mock("@norish/shared-react/trpc", () => ({
  useTRPC: () => ({
    library: {
      list: {
        infiniteQueryOptions: (input: unknown, opts: object) => ({
          ...opts,
          queryKey: [["library", "list"], { input, type: "infinite" }],
          initialPageParam: 0,
          queryFn: () =>
            world.offline || world.failing
              ? Promise.reject(new Error("unreachable"))
              : Promise.resolve({
                  items: world.items,
                  total: world.items.length,
                  nextCursor: null,
                }),
        }),
      },
    },
  }),
}));
vi.mock("@/components/no-results-card", () => ({
  NoResultsCard: ({ testID }: { testID: string }) => <div data-testid={testID} />,
}));
vi.mock("../components/discover", () => ({ Discover: () => null }));
vi.mock("../components/typing-suggestions", () => ({ TypingSuggestions: () => null }));
vi.mock("../components/scope-row", () => ({ ScopeRow: () => null }));
vi.mock("../components/results-chrome", () => ({ ChipRow: () => null, RecipeCount: () => null }));
vi.mock("../hooks/use-narrow-to", () => ({ useNarrowTo: () => () => {} }));
vi.mock("../hooks/use-search-field", () => ({
  useSearchField: () => [null, { text: "soup", focused: false }],
}));
vi.mock("../hooks/use-search-filters", async () => {
  const { useLibraryFilters } = await import("@norish/shared-react/recipes");

  return { useSearchFilters: () => useLibraryFilters((state) => state.filters) };
});
vi.mock("../hooks/use-typing-suggestions", () => ({
  useTypingSuggestions: () => ({ asked: "", loading: false, recipes: [], narrow: undefined }),
}));

const Results = ({
  noResults,
  recipes,
}: {
  noResults?: ReactNode;
  recipes: Array<{ id: string }>;
}) => (
  <div>
    {recipes.map((recipe) => (
      <span key={recipe.id} data-testid="row" />
    ))}
    {recipes.length === 0 ? noResults : null}
  </div>
);

async function draw() {
  const queryClient = createOfflineQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <LibraryFiltersProvider store={searchStore}>
        <SearchScreen Results={Results as never} />
      </LibraryFiltersProvider>
    </QueryClientProvider>
  );
  // Reads resolve and the retry delay (1s) passes.
  await act(() => vi.advanceTimersByTimeAsync(2000));
}

describe("Search's results area", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSearchSession();
    searchStore.getState().setFilters({ rawInput: "soup" });
    Object.assign(world, { offline: false, failing: false, items: [] });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("is the Offline card Offline with nothing held", async () => {
    world.offline = true;
    await draw();

    expect(screen.getByTestId("search-offline")).toBeTruthy();
    expect(screen.queryByTestId("search-no-results")).toBeNull();
  });

  it("is the rows for held results", async () => {
    world.items = [{ kind: "recipe", recipe: { id: "r1" } }];
    await draw();

    expect(screen.getAllByTestId("row")).toHaveLength(1);
    expect(screen.queryByTestId("search-offline")).toBeNull();
  });

  it("is the real no-results state for a held empty answer", async () => {
    await draw();

    expect(screen.getByTestId("search-no-results")).toBeTruthy();
    expect(screen.queryByTestId("search-offline")).toBeNull();
  });

  it("is the failed card, not no results, when a Live read failed with nothing held", async () => {
    world.failing = true;
    await draw();

    expect(screen.getByTestId("search-failed")).toBeTruthy();
    expect(screen.queryByTestId("search-no-results")).toBeNull();
    expect(screen.queryByTestId("search-offline")).toBeNull();
  });
});
