import { describe, expect, it } from "vitest";

import { matchCategory } from "@/server/ai/utils/category-matcher";

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
  });

  it("matches localized category translations", () => {
    expect(matchCategory("ontbijt")).toBe("Breakfast");
    expect(matchCategory("dejeuner")).toBe("Lunch");
    expect(matchCategory("abendessen")).toBe("Dinner");
    expect(matchCategory("collation")).toBe("Snack");
  });

  it("matches category words inside longer keyword phrases", () => {
    expect(matchCategory("quick weeknight dinner ideas")).toBe("Dinner");
  });

  it("returns null for no match", () => {
    expect(matchCategory("random gibberish")).toBeNull();
  });
});
