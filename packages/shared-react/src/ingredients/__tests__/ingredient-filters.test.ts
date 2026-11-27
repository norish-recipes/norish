import { describe, expect, it } from "vitest";

import { DEFAULT_INGREDIENT_FILTERS, hasIngredientFilters } from "../ingredient-filters";

describe("hasIngredientFilters", () => {
  it("is false for the defaults, and true once any filter differs", () => {
    expect(hasIngredientFilters(DEFAULT_INGREDIENT_FILTERS)).toBe(false);
    expect(hasIngredientFilters({ ...DEFAULT_INGREDIENT_FILTERS, flaggedOnly: true })).toBe(true);
    expect(hasIngredientFilters({ ...DEFAULT_INGREDIENT_FILTERS, standaloneOnly: true })).toBe(
      true
    );
    expect(hasIngredientFilters({ ...DEFAULT_INGREDIENT_FILTERS, tree: false })).toBe(true);
    expect(hasIngredientFilters({ ...DEFAULT_INGREDIENT_FILTERS, fields: [] })).toBe(true);
  });
});
