import { describe, expect, it } from "vitest";

import { hiddenItemVisibility } from "@norish/shared-react/reader";
import { DEFAULT_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

import {
  discoverSections,
  offeredQuickFilters,
  QUICK_FILTERS,
  toggleCategory,
  toggleQuickFilter,
  toggleTag,
} from "../utils/discover";

const shown = { recentCount: 3, categories: 4, tags: 6 };
const quick = (key: string) => QUICK_FILTERS.find((item) => item.key === key)!;

describe("discoverSections", () => {
  it("shows every section with the keyboard down", () => {
    expect(discoverSections({ ...shown, focused: false })).toEqual([
      "recent",
      "categories",
      "quickFilters",
      "tags",
    ]);
  });

  it("shows only Recent and Categories behind the keyboard", () => {
    expect(discoverSections({ ...shown, focused: true })).toEqual(["recent", "categories"]);
  });

  it("leaves out Recent when empty, and sections with no data", () => {
    expect(discoverSections({ focused: false, recentCount: 0, categories: 0, tags: 0 })).toEqual([
      "quickFilters",
    ]);
  });

  it("keeps a loading section, for its skeleton", () => {
    expect(
      discoverSections({ focused: false, recentCount: 0, categories: "loading", tags: "loading" })
    ).toEqual(["categories", "quickFilters", "tags"]);
  });

  it("hides a section whose read failed with nothing cached", () => {
    expect(
      discoverSections({ focused: false, recentCount: 0, categories: "failed", tags: "failed" })
    ).toEqual(["quickFilters"]);
  });
});

describe("Quick filters", () => {
  it("hides Favorites and 4 and up as Hidden Items hides them", () => {
    const keys = (hidden: string[]) =>
      offeredQuickFilters(hiddenItemVisibility(hidden)).map((item) => item.key);

    expect(keys([])).toEqual(["favorites", "underThirty", "fourAndUp", "pantry"]);
    expect(keys(["favorites"])).toEqual(["underThirty", "fourAndUp", "pantry"]);
    expect(keys(["rating"])).toEqual(["favorites", "underThirty", "pantry"]);
  });

  it("sets the filter the board names, and a second tap removes it", () => {
    const settings = {
      favorites: { showFavoritesOnly: true },
      underThirty: { maxCookingTime: 30 },
      fourAndUp: { minRating: 4 },
      pantry: { showPantryOnly: true },
    };

    for (const [key, patch] of Object.entries(settings)) {
      const filters = { ...DEFAULT_RECIPE_FILTERS };
      const on = { ...filters, ...toggleQuickFilter(filters, quick(key)) };

      expect(on).toMatchObject(patch);
      expect(quick(key).isOn(on)).toBe(true);
      expect(quick(key).isOn({ ...on, ...toggleQuickFilter(on, quick(key)) })).toBe(false);
    }
  });
});

describe("toggling a Category or Tag", () => {
  const filters = { ...DEFAULT_RECIPE_FILTERS, categories: ["Dinner"], searchTags: ["vegan"] };

  it("adds one that is off", () => {
    expect(toggleCategory(filters, "Lunch")).toEqual({ categories: ["Dinner", "Lunch"] });
    expect(toggleTag(filters, "quick")).toEqual({ searchTags: ["vegan", "quick"] });
  });

  it("removes one that is on, in any case", () => {
    expect(toggleCategory(filters, "dinner")).toEqual({ categories: [] });
    expect(toggleTag(filters, "Vegan")).toEqual({ searchTags: [] });
  });
});
