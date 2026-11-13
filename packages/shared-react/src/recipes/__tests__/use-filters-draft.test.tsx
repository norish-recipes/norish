import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_PERSISTED_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

import { LibraryFiltersProvider, useLibraryFilters } from "../library-filters-store";
import { nextSortOrder, useFiltersDraft } from "../use-filters-draft";

vi.mock("../../reader", () => ({
  useHiddenItemVisibility: () => ({ showRatings: false, showFavorites: true }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <LibraryFiltersProvider initial={DEFAULT_PERSISTED_RECIPE_FILTERS}>
    {children}
  </LibraryFiltersProvider>
);

const render = () =>
  renderHook(() => ({ edit: useFiltersDraft(), applied: useLibraryFilters((s) => s.filters) }), {
    wrapper,
  });

describe("nextSortOrder", () => {
  it("goes ascending, descending, off", () => {
    expect(nextSortOrder("none", "title")).toBe("titleAsc");
    expect(nextSortOrder("titleAsc", "title")).toBe("titleDesc");
    expect(nextSortOrder("titleDesc", "title")).toBe("none");
    expect(nextSortOrder("dateDesc", "title")).toBe("titleAsc");
  });
});

describe("useFiltersDraft", () => {
  it("keeps edits in the draft until apply", () => {
    const { result } = render();

    act(() => result.current.edit.toggleTag("vegan"));

    expect(result.current.edit.draft.searchTags).toEqual(["vegan"]);
    expect(result.current.applied.searchTags).toEqual([]);

    act(() => result.current.edit.apply());

    expect(result.current.applied.searchTags).toEqual(["vegan"]);
  });

  it("toggles a cooking time on and off", () => {
    const { result } = render();

    act(() => result.current.edit.toggleCookingTime(30));
    expect(result.current.edit.draft.maxCookingTime).toBe(30);
    act(() => result.current.edit.toggleCookingTime(30));
    expect(result.current.edit.draft.maxCookingTime).toBeNull();
  });

  it("drops a rating filter the reader has hidden", () => {
    const { result } = render();

    act(() => result.current.edit.update({ minRating: 4, showFavoritesOnly: true }));
    act(() => result.current.edit.apply());

    expect(result.current.applied.minRating).toBeNull();
    expect(result.current.applied.showFavoritesOnly).toBe(true);
  });

  it("resets the applied filters and the draft, keeping the lens", () => {
    const { result } = render();

    act(() => result.current.edit.toggleTag("vegan"));
    act(() => result.current.edit.apply());
    act(() => result.current.edit.reset());

    expect(result.current.applied.searchTags).toEqual([]);
    expect(result.current.edit.draft.searchTags).toEqual([]);
  });
});
