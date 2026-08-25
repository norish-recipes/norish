import { describe, expect, it } from "vitest";

import {
  DEFAULT_PERSISTED_RECIPE_FILTERS,
  DEFAULT_RECIPE_FILTERS,
  hasAppliedRecipeFilters,
  normalizePersistedRecipeFilters,
  serializeRecipeFilters,
  toggleSearchFieldIn,
  toRecipesQueryFilters,
} from "./filter-contract";

describe("recipe filter contract", () => {
  it("keeps deterministic defaults and query serialization", () => {
    const queryFilters = toRecipesQueryFilters(DEFAULT_RECIPE_FILTERS);

    expect(queryFilters).toEqual({
      search: undefined,
      searchFields: DEFAULT_RECIPE_FILTERS.searchFields,
      tags: undefined,
      categories: undefined,
      filterMode: "AND",
      sortMode: "dateDesc",
      minRating: undefined,
      maxCookingTime: undefined,
      type: "all",
    });
    expect(serializeRecipeFilters(DEFAULT_RECIPE_FILTERS)).toBe(JSON.stringify(queryFilters));
  });

  it("normalizes persisted filter payloads and rejects invalid values", () => {
    expect(
      normalizePersistedRecipeFilters({
        sortMode: "dateDesc",
        filterMode: "AND",
        searchTags: ["vegetarian"],
        searchFields: ["name"],
        showFavoritesOnly: true,
        minRating: 4,
        maxCookingTime: 30,
        categories: ["Dinner"],
      })
    ).toMatchObject({
      sortMode: "dateDesc",
      filterMode: "AND",
      searchTags: ["vegetarian"],
      showFavoritesOnly: true,
      minRating: 4,
      maxCookingTime: 30,
      categories: ["Dinner"],
    });

    expect(normalizePersistedRecipeFilters({ sortMode: "invalid" })).toBeNull();
  });

  it("never leaves a reader searching no fields at all", () => {
    expect(toggleSearchFieldIn(["title"], "steps")).toEqual(["title", "steps"]);
    expect(toggleSearchFieldIn(["title", "steps"], "steps")).toEqual(["title"]);
    // Unticking the last field restores the default pair rather than an empty set.
    expect(toggleSearchFieldIn(["title"], "title")).toEqual(DEFAULT_RECIPE_FILTERS.searchFields);
  });

  describe("the Library type filter", () => {
    it("defaults to All and serialises into the query filters", () => {
      expect(DEFAULT_RECIPE_FILTERS.libraryType).toBe("all");
      expect(
        toRecipesQueryFilters({ ...DEFAULT_RECIPE_FILTERS, libraryType: "cookbooks" })
      ).toMatchObject({ type: "cookbooks" });
      expect(
        serializeRecipeFilters({ ...DEFAULT_RECIPE_FILTERS, libraryType: "recipes" })
      ).toContain('"type":"recipes"');
    });

    it("survives a persistence round-trip", () => {
      const persisted = { ...DEFAULT_PERSISTED_RECIPE_FILTERS, libraryType: "cookbooks" as const };

      expect(normalizePersistedRecipeFilters(JSON.parse(JSON.stringify(persisted)))).toMatchObject({
        libraryType: "cookbooks",
      });
    });

    it("normalises an absent or unrecognised value to All", () => {
      // This is what keeps the mobile app working: it shares the contract,
      // never renders the chip, and must not have its filters corrupted.
      const { libraryType: _omitted, ...withoutType } = DEFAULT_PERSISTED_RECIPE_FILTERS;

      expect(normalizePersistedRecipeFilters(withoutType)).toMatchObject({ libraryType: "all" });
      expect(
        normalizePersistedRecipeFilters({
          ...DEFAULT_PERSISTED_RECIPE_FILTERS,
          libraryType: "shelves",
        })
      ).toMatchObject({ libraryType: "all" });
    });

    it("is excluded from the applied-filters predicate", () => {
      expect(hasAppliedRecipeFilters({ ...DEFAULT_RECIPE_FILTERS, libraryType: "cookbooks" })).toBe(
        false
      );
    });
  });
});
