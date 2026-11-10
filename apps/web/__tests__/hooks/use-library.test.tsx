import { useLibraryList } from "@/hooks/use-library";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLibraryQuery } from "@norish/shared-react/recipes";
import { DEFAULT_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

const filtersState = vi.hoisted(() => ({ filters: {} as object, isHydrated: true }));

vi.mock("@/context/recipes-filters-context", () => ({
  useRecipesFiltersContext: () => filtersState,
}));

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
    filtersState.filters = DEFAULT_RECIPE_FILTERS;
    filtersState.isHydrated = true;
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
    filtersState.isHydrated = false;

    const { result } = renderHook(() => useLibraryList());

    expect(result.current.isLoading).toBe(true);
    expect(useLibraryQuery).toHaveBeenLastCalledWith(expect.anything(), { enabled: false });
  });

  it("releases the gate once hydration applies the stored filters", () => {
    filtersState.isHydrated = false;
    const { result, rerender } = renderHook(() => useLibraryList());

    filtersState.filters = { ...DEFAULT_RECIPE_FILTERS, rawInput: "soup" };
    filtersState.isHydrated = true;
    rerender();

    expect(result.current.isLoading).toBe(false);
    expect(useLibraryQuery).toHaveBeenLastCalledWith(expect.objectContaining({ search: "soup" }), {
      enabled: true,
    });
  });

  it("renders straight through when nothing was stored, its recipes in grid order", () => {
    const { result } = renderHook(() => useLibraryList());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.recipes.map((recipe) => recipe.id)).toEqual([
      "unfiltered-1",
      "unfiltered-2",
    ]);
  });
});
