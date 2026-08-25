import { describe, expect, it } from "vitest";

import {
  DEFAULT_RECIPE_FILTERS,
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
});
