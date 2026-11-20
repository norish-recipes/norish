// @vitest-environment jsdom
/** The typing state's rows through the real store, field and Ingredient wiring. */
import type { ReactNode } from "react";
import React from "react";
import { getSearchConfirmed, resetSearchSession, searchStore } from "@/lib/search-session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LibraryFiltersProvider } from "@norish/shared-react/recipes";

import { useNarrowTo } from "../hooks/use-narrow-to";
import { useSearchField } from "../hooks/use-search-field";
import { filterChips } from "../utils/search-chips";
import { searchView } from "../utils/search-state";

vi.mock("@norish/shared-react/trpc", () => ({
  useTRPC: () => ({
    ingredients: { names: { queryKey: ({ ids }: { ids: string[] }) => ["names", ...ids] } },
  }),
}));

const chicken = "a0000000-0000-4000-8000-000000000001";
const queryClient = new QueryClient();
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <LibraryFiltersProvider store={searchStore}>{children}</LibraryFiltersProvider>
  </QueryClientProvider>
);

function mount() {
  return renderHook(
    () => {
      const [, field] = useSearchField();

      return { field, narrowTo: useNarrowTo(field.narrowed) };
    },
    { wrapper }
  );
}

const typed = (text: string) => ({ nativeEvent: { text } });
const state = () => searchStore.getState().filters;
const view = (text: string, confirmed: boolean) =>
  searchView({
    text,
    confirmed,
    hasChips: filterChips(state()).length > 0,
    focused: true,
    resultCount: 3,
  });

describe("a Narrow-to row", () => {
  beforeEach(() => {
    resetSearchSession();
    queryClient.clear();
  });

  it("adds one Ingredient chip with its name in the same render, clears the text, shows Results", () => {
    const { result } = mount();

    act(() => result.current.field.onChangeText(typed("chick")));
    expect(view(state().rawInput, false)).toBe("typing");

    act(() => result.current.narrowTo({ kind: "ingredient", id: chicken, name: "Kip" }));

    expect(state().ingredients).toEqual([chicken]);
    expect(filterChips(state())).toHaveLength(1);
    expect(queryClient.getQueryData(["names", chicken])).toEqual({ [chicken]: "Kip" });
    expect(state().rawInput).toBe("");
    expect(result.current.field.text).toBe("");
    expect(view(state().rawInput, false)).toBe("results");
  });

  it("adds one Tag chip, and one Category chip, each clearing the text", () => {
    const { result } = mount();

    act(() => result.current.field.onChangeText(typed("din")));
    act(() => result.current.narrowTo({ kind: "tag", name: "dinner party" }));

    expect(state().searchTags).toEqual(["dinner party"]);
    expect(filterChips(state())).toHaveLength(1);
    expect(state().rawInput).toBe("");

    act(() => result.current.field.onChangeText(typed("din")));
    act(() => result.current.narrowTo({ kind: "category", name: "Dinner", label: "Diner" }));

    expect(state().categories).toEqual(["Dinner"]);
    expect(filterChips(state())).toHaveLength(2);
    expect(view(state().rawInput, false)).toBe("results");
  });

  it("adds a second chip on a second narrow, and still shows Results", () => {
    const { result } = mount();

    act(() => result.current.field.onChangeText(typed("chick")));
    act(() => result.current.narrowTo({ kind: "ingredient", id: chicken, name: "Chicken" }));
    act(() => result.current.field.onChangeText(typed("quick")));

    expect(view(state().rawInput, false)).toBe("typing");

    act(() => result.current.narrowTo({ kind: "tag", name: "quick" }));

    expect(filterChips(state())).toHaveLength(2);
    expect(view(state().rawInput, false)).toBe("results");
  });
});

describe("confirming", () => {
  beforeEach(() => resetSearchSession());

  it("reaches the same state from the Search for row and from the search key", () => {
    const fromRow = mount();

    act(() => fromRow.result.current.field.onChangeText(typed("chick")));
    act(() => fromRow.result.current.field.confirm());

    const afterRow = { text: state().rawInput, view: view(state().rawInput, getSearchConfirmed()) };

    resetSearchSession();

    const fromKey = mount();

    act(() => fromKey.result.current.field.onChangeText(typed("chick")));
    act(() => fromKey.result.current.field.onSearchButtonPress(typed("chick")));

    expect({ text: state().rawInput, view: view(state().rawInput, getSearchConfirmed()) }).toEqual(
      afterRow
    );
    expect(afterRow).toEqual({ text: "chick", view: "results" });
  });
});
