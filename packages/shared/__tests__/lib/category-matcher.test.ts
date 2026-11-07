import { describe, expect, it } from "vitest";

import { matchCategory, resolveBuiltInCategory } from "@norish/shared/lib/category-matcher";

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

  it("leaves synonyms, fuzzy spellings and phrases as names of their own", () => {
    expect(resolveBuiltInCategory("Desserts")).toBeNull();
    expect(resolveBuiltInCategory("Appetizers")).toBeNull();
    expect(resolveBuiltInCategory("Side dishes")).toBeNull();
    expect(resolveBuiltInCategory("brunch")).toBeNull();
    expect(resolveBuiltInCategory("breakfst")).toBeNull();
    expect(resolveBuiltInCategory("quick dinner")).toBeNull();
  });
});
