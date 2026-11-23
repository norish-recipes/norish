import { describe, expect, it } from "vitest";

import { hiddenItemVisibility } from "@norish/shared-react/reader";
import { withoutHiddenFilters } from "@norish/shared-react/recipes";
import {
  DEFAULT_RECIPE_FILTERS,
  hasAppliedRecipeFilters,
} from "@norish/shared/contracts/filter-contract";

import {
  chipIcon,
  chipKey,
  chipLabel,
  filterChips,
  quickFilters,
  withoutChip,
} from "../utils/search-chips";

const onion = "a0000000-0000-4000-8000-000000000001";
const garlic = "a0000000-0000-4000-8000-000000000002";

const applied = {
  ...DEFAULT_RECIPE_FILTERS,
  categories: ["Dinner"],
  searchTags: ["vegan", "quick"],
  ingredients: [onion, garlic],
  maxCookingTime: 30,
  minRating: 4,
  showFavoritesOnly: true,
  showPantryOnly: true,
};

const everything = {
  showRatings: true,
  showFavorites: true,
  showConversion: true,
  showProvenance: true,
  showNutrition: true,
  showNotes: true,
  showCookbooks: true,
  showIngredientIcons: true,
};

describe("filter chips", () => {
  it("has none for the defaults, and the text is not one", () => {
    expect(filterChips(DEFAULT_RECIPE_FILTERS)).toEqual([]);
    expect(filterChips({ ...DEFAULT_RECIPE_FILTERS, rawInput: "soup" })).toEqual([]);
  });

  it("has one per applied filter", () => {
    expect(filterChips(applied).map(chipKey)).toEqual([
      "category:Dinner",
      "tag:vegan",
      "tag:quick",
      `ingredient:${onion}`,
      `ingredient:${garlic}`,
      "time:30",
      "rating:4",
      "favorites:true",
      "pantry:true",
    ]);
  });

  it("has a chip for every filter the shared rule counts, so the two cannot drift", () => {
    const each = [
      { categories: ["Dinner"] },
      { searchTags: ["vegan"] },
      { ingredients: [onion] },
      { maxCookingTime: 30 },
      { minRating: 4 },
      { showFavoritesOnly: true },
      { showPantryOnly: true },
    ];

    for (const patch of each) {
      const filters = { ...DEFAULT_RECIPE_FILTERS, ...patch };

      expect(hasAppliedRecipeFilters(filters)).toBe(true);
      expect(filterChips(filters)).not.toEqual([]);
    }
  });

  it("removes only the one it names", () => {
    expect(withoutChip(applied, { kind: "tag", value: "vegan" })).toEqual({
      searchTags: ["quick"],
    });
    expect(withoutChip(applied, { kind: "ingredient", value: onion })).toEqual({
      ingredients: [garlic],
    });
    expect(withoutChip(applied, { kind: "category", value: "Dinner" })).toEqual({ categories: [] });
    expect(withoutChip(applied, { kind: "time", value: 30 })).toEqual({ maxCookingTime: null });
    expect(withoutChip(applied, { kind: "rating", value: 4 })).toEqual({ minRating: null });
    expect(withoutChip(applied, { kind: "favorites", value: true })).toEqual({
      showFavoritesOnly: false,
    });
    expect(withoutChip(applied, { kind: "pantry", value: true })).toEqual({
      showPantryOnly: false,
    });
  });

  it("says each kind from its own message", () => {
    const speech = {
      say: (id: string, values?: Record<string, string | number>) =>
        values ? `${id}:${Object.values(values).join()}` : id,
      category: (name: string) => `cat ${name}`,
      ingredient: (id: string) => (id === onion ? "onion" : ""),
    };

    expect(chipLabel({ kind: "category", value: "Dinner" }, speech)).toBe("cat Dinner");
    expect(chipLabel({ kind: "tag", value: "vegan" }, speech)).toBe("vegan");
    expect(chipLabel({ kind: "ingredient", value: onion }, speech)).toBe("onion");
    // A food that no longer resolves says nothing, and its chip still removes it.
    expect(chipLabel({ kind: "ingredient", value: garlic }, speech)).toBe("");
    expect(chipLabel({ kind: "time", value: 30 }, speech)).toBe(
      "common.filters.cookingTimeUnder30"
    );
    expect(chipLabel({ kind: "time", value: 45 }, speech)).toBe("common.filters.cookingTime");
    expect(chipLabel({ kind: "rating", value: 4 }, speech)).toBe("recipes.search.ratingChip:4");
    expect(chipLabel({ kind: "favorites", value: true }, speech)).toBe("common.filters.favorites");
    expect(chipLabel({ kind: "pantry", value: true }, speech)).toBe("common.filters.pantryOnly");
  });
});

describe("a chip's icon", () => {
  it("is the Ingredient's for an Ingredient chip and none for the rest", () => {
    expect(chipIcon({ kind: "ingredient", value: onion })).toBe(onion);
    expect(chipIcon({ kind: "tag", value: "vegan" })).toBeNull();
    expect(chipIcon({ kind: "time", value: 30 })).toBeNull();
  });
});

describe("filters the reader hid", () => {
  it("drops a kept favourites or rating filter once its item is hidden", () => {
    expect(
      withoutHiddenFilters(applied, { ...everything, showFavorites: false, showRatings: false })
    ).toEqual({ ...applied, showFavoritesOnly: false, minRating: null });
    expect(withoutHiddenFilters(applied, { ...everything, showRatings: false })).toEqual({
      ...applied,
      minRating: null,
    });
  });

  it("leaves everything else, and does nothing while the items show", () => {
    const vegan = { ...DEFAULT_RECIPE_FILTERS, searchTags: ["vegan"] };

    expect(withoutHiddenFilters(applied, everything)).toBe(applied);
    expect(
      withoutHiddenFilters(vegan, { ...everything, showFavorites: false, showRatings: false })
    ).toBe(vegan);
  });
});

describe("the filters Search reads", () => {
  const hidden = { ...everything, showFavorites: false, showRatings: false };

  it("leaves out a hidden kept filter, so it neither shows nor filters", () => {
    const seen = withoutHiddenFilters(applied, hidden);

    expect(seen).toMatchObject({
      showFavoritesOnly: false,
      minRating: null,
      searchTags: ["vegan", "quick"],
    });
    expect(filterChips(seen).map((chip) => chip.kind)).toEqual([
      "category",
      "tag",
      "tag",
      "ingredient",
      "ingredient",
      "time",
      "pantry",
    ]);
    expect(
      filterChips(withoutHiddenFilters({ ...DEFAULT_RECIPE_FILTERS, minRating: 4 }, hidden))
    ).toEqual([]);
  });

  it("is the filters themselves while the items show", () => {
    expect(withoutHiddenFilters(applied, everything)).toBe(applied);
  });
});

describe("Quick filters", () => {
  const all = quickFilters(hiddenItemVisibility([]));

  it("hides Favorites and 4 and up as Hidden Items hides them", () => {
    const kinds = (hidden: string[]) =>
      quickFilters(hiddenItemVisibility(hidden)).map((item) => item.kind);

    expect(kinds([])).toEqual(["favorites", "time", "rating", "pantry"]);
    expect(kinds(["favorites"])).toEqual(["time", "rating", "pantry"]);
    expect(kinds(["rating"])).toEqual(["favorites", "time", "pantry"]);
  });

  it("sets the filter the board names, which its chip's × removes", () => {
    expect(Object.fromEntries(all.map((item) => [item.kind, item.on]))).toEqual({
      favorites: { showFavoritesOnly: true },
      time: { maxCookingTime: 30 },
      rating: { minRating: 4 },
      pantry: { showPantryOnly: true },
    });

    for (const quick of all) {
      const on = { ...DEFAULT_RECIPE_FILTERS, ...quick.on };
      const [chip] = filterChips(on);

      expect(chip?.kind).toBe(quick.kind);
      expect(hasAppliedRecipeFilters({ ...on, ...withoutChip(on, chip!) })).toBe(false);
    }
  });
});
