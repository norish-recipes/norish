import { describe, expect, it } from "vitest";

import { DEFAULT_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

import { chipKey, filterChips, withoutChip } from "../utils/search-chips";
import { hasSearchFilters } from "../utils/search-state";

const applied = {
  ...DEFAULT_RECIPE_FILTERS,
  categories: ["Dinner"],
  searchTags: ["vegan", "quick"],
  maxCookingTime: 30,
  minRating: 4,
  showFavoritesOnly: true,
  showPantryOnly: true,
};

describe("filter chips", () => {
  it("has none for the defaults, and the text is not one", () => {
    expect(filterChips(DEFAULT_RECIPE_FILTERS)).toEqual([]);
    expect(filterChips({ ...DEFAULT_RECIPE_FILTERS, rawInput: "soup" })).toEqual([]);
  });

  it("has one per applied filter, matching what hasSearchFilters counts", () => {
    expect(filterChips(applied).map(chipKey)).toEqual([
      "category:Dinner",
      "tag:vegan",
      "tag:quick",
      "time:30",
      "rating:4",
      "favorites:",
      "pantry:",
    ]);
    expect(hasSearchFilters(applied)).toBe(true);
    expect(hasSearchFilters(DEFAULT_RECIPE_FILTERS)).toBe(false);
  });

  it("removes only the one it names", () => {
    expect(withoutChip(applied, { kind: "tag", value: "vegan" })).toEqual({ searchTags: ["quick"] });
    expect(withoutChip(applied, { kind: "category", value: "Dinner" })).toEqual({ categories: [] });
    expect(withoutChip(applied, { kind: "time", value: 30 })).toEqual({ maxCookingTime: null });
    expect(withoutChip(applied, { kind: "rating", value: 4 })).toEqual({ minRating: null });
    expect(withoutChip(applied, { kind: "favorites" })).toEqual({ showFavoritesOnly: false });
    expect(withoutChip(applied, { kind: "pantry" })).toEqual({ showPantryOnly: false });
  });
});
