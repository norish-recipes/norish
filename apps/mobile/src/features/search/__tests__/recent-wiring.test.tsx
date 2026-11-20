// @vitest-environment jsdom
/** What keeps a Recent Search, and what the Recent rows do, through the real store and field. */
import type { ReactNode } from "react";
import React from "react";
import { getSearchConfirmed, resetSearchSession, searchStore } from "@/lib/search-session";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LibraryFiltersProvider } from "@norish/shared-react/recipes";

import { useSearchField } from "../hooks/use-search-field";

const kept = vi.hoisted(() => vi.fn());

vi.mock("../utils/recent-searches-store", () => ({ addRecentSearch: kept }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <LibraryFiltersProvider store={searchStore}>{children}</LibraryFiltersProvider>
);
const mount = () => renderHook(() => useSearchField()[1], { wrapper });
const typed = (text: string) => ({ nativeEvent: { text } });

describe("Recent Searches kept by the field", () => {
  beforeEach(() => {
    resetSearchSession();
    kept.mockClear();
  });

  it("keeps a text confirmed with the search key or the Search for row", () => {
    const { result } = mount();

    act(() => result.current.onChangeText(typed("tacos")));
    expect(kept).not.toHaveBeenCalled();

    act(() => result.current.onSearchButtonPress(typed("tacos")));
    act(() => result.current.confirm());

    expect(kept.mock.calls).toEqual([["tacos"], ["tacos"]]);
  });

  it("never keeps a Narrow-to tap or a tapped chip", () => {
    const { result } = mount();

    act(() => result.current.onChangeText(typed("chick")));
    act(() => result.current.narrowed());
    act(() => searchStore.getState().setFilters({ searchTags: ["vegan"] }));

    expect(kept).not.toHaveBeenCalled();
  });

  it("re-runs a Recent Search as a confirmed text", () => {
    const { result } = mount();

    act(() => result.current.run("naan pizza"));

    expect(searchStore.getState().filters.rawInput).toBe("naan pizza");
    expect(getSearchConfirmed()).toBe(true);
  });

  it("puts a Recent Search in the field to edit, unconfirmed and not kept again", () => {
    const { result } = mount();

    act(() => result.current.edit("falafel"));

    expect(searchStore.getState().filters.rawInput).toBe("falafel");
    expect(getSearchConfirmed()).toBe(false);
    expect(kept).not.toHaveBeenCalled();
  });
});
