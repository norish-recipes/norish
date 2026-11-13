import { describe, expect, it } from "vitest";

import { BUILT_IN_CATEGORIES, resolveCategoryName } from "@norish/shared/lib/categories";
import {
  BUILT_IN_ALIASES,
  matchCategory,
  resolveBuiltInCategory,
  sortSourceCategories,
} from "@norish/shared/lib/category-matcher";

describe("matchCategory", () => {
  it("matches exact categories", () => {
    expect(matchCategory("breakfast")).toBe("Breakfast");
  });

  it("matches synonyms", () => {
    expect(matchCategory("brunch")).toBe("Breakfast");
    expect(matchCategory("supper")).toBe("Dinner");
  });

  it("matches fuzzy input", () => {
    expect(matchCategory("breakfst")).toBe("Breakfast");
    expect(matchCategory("snak")).toBe("Snack");
  });

  it("matches localized category translations", () => {
    expect(matchCategory("ontbijt")).toBe("Breakfast");
    expect(matchCategory("dejeuner")).toBe("Lunch");
    expect(matchCategory("abendessen")).toBe("Dinner");
    expect(matchCategory("collation")).toBe("Snack");
  });

  it("matches translations written in Cyrillic, Hangul and Arabic", () => {
    expect(matchCategory("Ужин")).toBe("Dinner");
    expect(matchCategory("Сніданок")).toBe("Breakfast");
    expect(matchCategory("간식")).toBe("Snack");
    expect(matchCategory("غداء")).toBe("Lunch");
  });

  it("matches category words inside longer keyword phrases", () => {
    expect(matchCategory("quick weeknight dinner ideas")).toBe("Dinner");
  });

  it("keeps explicit synonyms and a built-in word inside a phrase", () => {
    expect(matchCategory("dessert")).toBe("Snack");
    expect(matchCategory("main course")).toBe("Dinner");
    expect(matchCategory("Quick dinner")).toBe("Dinner");
  });

  it("does not stretch a dish or a word fragment into a built-in", () => {
    for (const word of ["Bread", "Soup", "Fish", "Main", "Pie", "Inner"]) {
      expect(matchCategory(word), word).toBeNull();
    }
  });

  it("returns null for no match", () => {
    expect(matchCategory("random")).toBeNull();
    expect(matchCategory("random gibberish")).toBeNull();
  });
});

describe("resolveBuiltInCategory", () => {
  it("resolves a built-in's name, any-locale translation or plural, whatever the case", () => {
    expect(resolveBuiltInCategory("BREAKFAST")).toBe("Breakfast");
    expect(resolveBuiltInCategory("Ontbijt")).toBe("Breakfast");
    expect(resolveBuiltInCategory("Snacks")).toBe("Snack");
    expect(resolveBuiltInCategory("déjeuner")).toBe("Lunch");
    expect(resolveBuiltInCategory("Ужин")).toBe("Dinner");
    expect(resolveBuiltInCategory("간식")).toBe("Snack");
  });

  it("matches nothing for a name two locales give to different built-ins", () => {
    // Danish "Frokost" is lunch, Norwegian "Frokost" is breakfast.
    expect(resolveBuiltInCategory("Frokost")).toBeNull();
    expect(matchCategory("Frokost")).toBeNull();
    expect(matchCategory("frokost ideas")).toBeNull();
  });

  it("leaves synonyms, fuzzy spellings and phrases as names of their own", () => {
    expect(resolveBuiltInCategory("Desserts")).toBeNull();
    expect(resolveBuiltInCategory("Appetizers")).toBeNull();
    expect(resolveBuiltInCategory("Side dishes")).toBeNull();
    expect(resolveBuiltInCategory("brunch")).toBeNull();
    expect(resolveBuiltInCategory("breakfst")).toBeNull();
    expect(resolveBuiltInCategory("quick dinner")).toBeNull();
  });
});

describe("resolveCategoryName", () => {
  it("cleans a name, then picks a built-in, then an existing name by case", () => {
    expect(resolveCategoryName("  ontbijt ", BUILT_IN_ALIASES, [])).toBe("Breakfast");
    expect(resolveCategoryName("SNACKS", BUILT_IN_ALIASES, [])).toBe("Snack");
    expect(resolveCategoryName("desserts", BUILT_IN_ALIASES, ["Desserts"])).toBe("Desserts");
    expect(resolveCategoryName(" Side   dishes ", BUILT_IN_ALIASES, [])).toBe("Side dishes");
    expect(resolveCategoryName("Frokost", BUILT_IN_ALIASES, [])).toBe("Frokost");
    expect(resolveCategoryName("   ", BUILT_IN_ALIASES, [])).toBe("");
  });

  it("is given only names and translations, never synonyms or ambiguous names", () => {
    expect(BUILT_IN_ALIASES).toMatchObject({ ontbijt: "Breakfast", "petit dejeuner": "Breakfast" });
    expect(BUILT_IN_ALIASES).not.toHaveProperty("brunch");
    expect(BUILT_IN_ALIASES).not.toHaveProperty("frokost");
  });
});

describe("sortSourceCategories", () => {
  const household = [...BUILT_IN_CATEGORIES, "Dessert", "Drinks"];

  it("keeps a household Category in the household's spelling, ahead of the matcher", () => {
    expect(sortSourceCategories(["drinks", "DESSERT"], household)).toEqual({
      categories: ["Drinks", "Dessert"],
      tags: [],
    });
  });

  it("catches a household Category's plural and accented spelling", () => {
    expect(sortSourceCategories(["Desserts", "dessért", "Drink"], household)).toEqual({
      categories: ["Dessert"],
      tags: ["Drink"],
    });
  });

  it("then matches a built-in through synonyms and fuzz", () => {
    expect(sortSourceCategories(["Brunch", "supper", "Appetizers"], household)).toEqual({
      categories: ["Breakfast", "Dinner", "Snack"],
      tags: [],
    });
  });

  it("keeps anything else as a Tag, never a new Category", () => {
    expect(sortSourceCategories(["Holiday", " Cocktails ", "", "holiday"], household)).toEqual({
      categories: [],
      tags: ["Holiday", "Cocktails"],
    });
  });

  it("lists each Category once", () => {
    expect(sortSourceCategories(["Dinner", "supper", "drinks", "Drinks"], household)).toEqual({
      categories: ["Dinner", "Drinks"],
      tags: [],
    });
  });
});
