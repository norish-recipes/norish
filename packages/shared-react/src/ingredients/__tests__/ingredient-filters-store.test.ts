import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEFAULT_INGREDIENT_FILTERS } from "../ingredient-filters";
import { useIngredientFiltersStore } from "../ingredient-filters-store";

describe("useIngredientFiltersStore", () => {
  it("holds what is applied for every reader, and resets to the defaults", () => {
    const a = renderHook(() => useIngredientFiltersStore((s) => s));
    const b = renderHook(() => useIngredientFiltersStore((s) => s.filters.flaggedOnly));

    act(() => a.result.current.apply({ ...DEFAULT_INGREDIENT_FILTERS, flaggedOnly: true }));
    expect(b.result.current).toBe(true);
    act(() => a.result.current.reset());
    expect(b.result.current).toBe(false);
  });
});
