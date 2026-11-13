import { describe, expect, it } from "vitest";

import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { DEFAULT_PERSISTED_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

import { hasActiveLibraryFilters } from "../library-filters-active";

const filters = (over: Partial<CanonicalRecipeFilters> = {}): CanonicalRecipeFilters => ({
  ...DEFAULT_PERSISTED_RECIPE_FILTERS,
  rawInput: "",
  ...over,
});

describe("hasActiveLibraryFilters", () => {
  it("is off for the defaults", () => {
    expect(hasActiveLibraryFilters(filters())).toBe(false);
  });

  it("is on for a lone minimum rating", () => {
    expect(hasActiveLibraryFilters(filters({ minRating: 4 }))).toBe(true);
  });

  it("is on for an applied filter", () => {
    expect(hasActiveLibraryFilters(filters({ categories: ["Dinner"] }))).toBe(true);
  });
});
