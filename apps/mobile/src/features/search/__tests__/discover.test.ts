import { describe, expect, it } from "vitest";

import { hiddenItemVisibility } from "@norish/shared-react/reader";

import { discoverSections, offeredQuickFilters, QUICK_FILTERS } from "../utils/discover";

const shown = { recentCount: 3, categories: 4, tags: 6 };

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

  it("sets the filter the board names", () => {
    expect(Object.fromEntries(QUICK_FILTERS.map((item) => [item.key, item.on]))).toEqual({
      favorites: { showFavoritesOnly: true },
      underThirty: { maxCookingTime: 30 },
      fourAndUp: { minRating: 4 },
      pantry: { showPantryOnly: true },
    });
  });
});
