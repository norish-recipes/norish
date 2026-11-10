import type { ReactNode } from "react";
import { useLibraryList } from "@/hooks/use-library";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PersistedRecipeFilters } from "@norish/shared/contracts/filter-contract";
import {
  LibraryFiltersProvider,
  useLibraryFiltersStoreApi,
  useLibraryQuery,
} from "@norish/shared-react/recipes";
import { DEFAULT_PERSISTED_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

/** The list and its filters store, made from the cookie's filters (`undefined`: no cookie). */
function renderList(cookie: PersistedRecipeFilters | undefined) {
  return renderHook(() => ({ list: useLibraryList(), store: useLibraryFiltersStoreApi() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <LibraryFiltersProvider initial={cookie}>{children}</LibraryFiltersProvider>
    ),
  });
}

vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useLibraryQuery: vi.fn(),
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
