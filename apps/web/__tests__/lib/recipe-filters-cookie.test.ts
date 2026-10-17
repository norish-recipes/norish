import { recipeFiltersCookieValue, recipeFiltersFromCookie } from "@/lib/recipe-filters-cookie";
import { describe, expect, it } from "vitest";

import type { PersistedRecipeFilters } from "@norish/shared-react/filter-contract";
import { DEFAULT_PERSISTED_RECIPE_FILTERS } from "@norish/shared-react/filter-contract";

describe("the Library filters cookie", () => {
  it("round-trips the stored filters, carrying only what differs from the defaults", () => {
    const filters: PersistedRecipeFilters = {
      ...DEFAULT_PERSISTED_RECIPE_FILTERS,
      sortMode: "titleAsc",
      categories: ["Dinner"],
      showFavoritesOnly: true,
      libraryType: "cookbooks",
    };
    const value = recipeFiltersCookieValue(filters);

    expect(JSON.parse(decodeURIComponent(value))).toEqual({
      sortMode: "titleAsc",
      categories: ["Dinner"],
      showFavoritesOnly: true,
      libraryType: "cookbooks",
    });
    expect(recipeFiltersFromCookie(value)).toEqual(filters);
  });

  it("is empty for the defaults, and reads back as them", () => {
    const value = recipeFiltersCookieValue(DEFAULT_PERSISTED_RECIPE_FILTERS);

    expect(decodeURIComponent(value)).toBe("{}");
    expect(recipeFiltersFromCookie(value)).toEqual(DEFAULT_PERSISTED_RECIPE_FILTERS);
  });

  it.each([
    ["not JSON", "%7Bnot"],
    ["not an object", "5"],
    ["null", "null"],
    ["an unknown sort", encodeURIComponent('{"sortMode":"sideways"}')],
    ["a broken escape", "%E0%A4%A"],
  ])("reads a cookie that is %s as the defaults", (_, value) => {
    expect(recipeFiltersFromCookie(value)).toEqual(DEFAULT_PERSISTED_RECIPE_FILTERS);
  });
});
