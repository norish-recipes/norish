import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PersistedRecipeFilters } from "@norish/shared/contracts/filter-contract";
import {
  DEFAULT_PERSISTED_RECIPE_FILTERS,
  hasAppliedRecipeFilters,
} from "@norish/shared/contracts/filter-contract";

import { LibraryFiltersProvider, useLibraryFiltersStoreApi } from "../library-filters-store";
import { useAppliedLibraryFilters, useLibraryList } from "../use-library-list";
import { useLibraryQuery } from "../use-library-query";

/** The list and its filters store, made from the cookie's filters (`undefined`: no cookie). */
function renderList(cookie: PersistedRecipeFilters | undefined) {
  return renderHook(() => ({ list: useLibraryList(), store: useLibraryFiltersStoreApi() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <LibraryFiltersProvider initial={cookie}>{children}</LibraryFiltersProvider>
    ),
  });
}

vi.mock("../use-library-query", () => ({ useLibraryQuery: vi.fn() }));

const visibility = vi.hoisted(() => ({ showRatings: true, showFavorites: true }));

vi.mock("../../reader", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHiddenItemVisibility: () => visibility,
}));

const UNFILTERED = [
  { kind: "recipe", recipe: { id: "unfiltered-1" } },
  { kind: "cookbook", cookbook: { id: "cookbook-1" } },
  { kind: "recipe", recipe: { id: "unfiltered-2" } },
];

describe("the library never paints unfiltered", () => {
  beforeEach(() => {
    // The persisted query cache can answer the default-filters key instantly,
    // so the fake reports loaded unfiltered data even while disabled.
    vi.mocked(useLibraryQuery)
      .mockReset()
      .mockReturnValue({
        items: UNFILTERED,
        total: UNFILTERED.length,
        isLoading: false,
      } as never);
  });

  it("holds the loading presentation until the stored filters are applied", () => {
    const { result } = renderList(undefined);

    expect(result.current.list.isLoading).toBe(true);
  });

  it("releases the gate once hydration applies the stored filters", () => {
    const { result } = renderList(undefined);

    act(() =>
      result.current.store
        .getState()
        .applyStored({ ...DEFAULT_PERSISTED_RECIPE_FILTERS, sortMode: "titleAsc" })
    );

    expect(result.current.list.isLoading).toBe(false);
  });

  it("renders straight through under the cookie's filters, its recipes in grid order", () => {
    const { result } = renderList(DEFAULT_PERSISTED_RECIPE_FILTERS);

    expect(result.current.list.isLoading).toBe(false);
    expect(result.current.list.recipes.map((recipe) => recipe.id)).toEqual([
      "unfiltered-1",
      "unfiltered-2",
    ]);
  });
});

describe("Search's flag and gate", () => {
  beforeEach(() => {
    vi.mocked(useLibraryQuery)
      .mockReset()
      .mockReturnValue({ items: [], total: 0, isLoading: false } as never);
  });

  const renderSearch = (options: Parameters<typeof useLibraryList>[0]) =>
    renderHook(() => useLibraryList(options), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <LibraryFiltersProvider initial={DEFAULT_PERSISTED_RECIPE_FILTERS}>
          {children}
        </LibraryFiltersProvider>
      ),
    });

  it("sends sortBeatsRank only when asked, and reads nothing when disabled", () => {
    renderSearch({ sortBeatsRank: true, enabled: false });

    expect(useLibraryQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBeatsRank: true }),
      { enabled: false }
    );

    renderSearch(undefined);

    expect(useLibraryQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBeatsRank: undefined }),
      { enabled: true }
    );
  });
});

describe("a filter on a Hidden Item", () => {
  beforeEach(() => {
    vi.mocked(useLibraryQuery)
      .mockReset()
      .mockReturnValue({ items: [], total: 0, isLoading: false } as never);
  });
  afterEach(() => Object.assign(visibility, { showRatings: true, showFavorites: true }));

  it("stops narrowing the list once the reader hides it", () => {
    const { rerender } = renderList({
      ...DEFAULT_PERSISTED_RECIPE_FILTERS,
      minRating: 4,
      showFavoritesOnly: true,
    });

    expect(useLibraryQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ minRating: 4, favoritesOnly: true }),
      expect.anything()
    );

    Object.assign(visibility, { showRatings: false, showFavorites: false });
    rerender();

    expect(useLibraryQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ minRating: undefined, favoritesOnly: false }),
      expect.anything()
    );
  });

  it("is no applied filter while hidden, and applies again once shown", () => {
    const { result, rerender } = renderHook(() => useAppliedLibraryFilters(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <LibraryFiltersProvider initial={{ ...DEFAULT_PERSISTED_RECIPE_FILTERS, minRating: 4 }}>
          {children}
        </LibraryFiltersProvider>
      ),
    });

    Object.assign(visibility, { showRatings: false });
    rerender();
    expect(hasAppliedRecipeFilters(result.current)).toBe(false);

    Object.assign(visibility, { showRatings: true });
    rerender();
    expect(result.current.minRating).toBe(4);
  });
});
