import {
  RECIPE_FILTERS_STORAGE_KEY,
  webRecipeFiltersStorageAdapter,
} from "@/hooks/recipes/recipe-filters-storage-adapter";
import {
  RECIPE_FILTERS_COOKIE,
  recipeFiltersCookieValue,
  recipeFiltersFromCookie,
} from "@/lib/recipe-filters-cookie";
import { afterEach, describe, expect, it } from "vitest";

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

describe("the browser's filters storage", () => {
  const cookie = () =>
    document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${RECIPE_FILTERS_COOKIE}=`))
      ?.slice(RECIPE_FILTERS_COOKIE.length + 1);

  afterEach(() => {
    localStorage.clear();
    document.cookie = `${RECIPE_FILTERS_COOKIE}=; max-age=0; path=/`;
  });

  it("tells the server every filter it stores, through the cookie", () => {
    const filters = { ...DEFAULT_PERSISTED_RECIPE_FILTERS, sortMode: "titleAsc" as const };

    webRecipeFiltersStorageAdapter.setItem(RECIPE_FILTERS_STORAGE_KEY, JSON.stringify(filters));

    expect(localStorage.getItem(RECIPE_FILTERS_STORAGE_KEY)).toBe(JSON.stringify(filters));
    expect(recipeFiltersFromCookie(cookie()!)).toEqual(filters);
  });

  it("sets the cookie back to the defaults when the filters are cleared", () => {
    webRecipeFiltersStorageAdapter.setItem(
      RECIPE_FILTERS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_PERSISTED_RECIPE_FILTERS, sortMode: "titleAsc" })
    );
    webRecipeFiltersStorageAdapter.removeItem(RECIPE_FILTERS_STORAGE_KEY);

    expect(decodeURIComponent(cookie()!)).toBe("{}");
  });
});
