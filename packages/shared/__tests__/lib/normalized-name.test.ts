import { describe, expect, it } from "vitest";

import { nameWords, normalizeGroceryName } from "@norish/shared/lib/normalized-name";

describe("normalizeGroceryName", () => {
  it("folds case", () => {
    expect(normalizeGroceryName("Oude Kaas")).toBe("oude kaas");
  });

  it("folds diacritics", () => {
    expect(normalizeGroceryName("Crème fraîche")).toBe("creme fraiche");
    expect(normalizeGroceryName("Käse")).toBe("kase");
  });

  it("folds punctuation and collapses whitespace", () => {
    expect(normalizeGroceryName("  oude   kaas!  ")).toBe("oude kaas");
    expect(normalizeGroceryName("half-volle melk (1L)")).toBe("half volle melk 1l");
  });

  it("keeps letters of every script", () => {
    expect(normalizeGroceryName("Сыр")).toBe("сыр");
    expect(normalizeGroceryName("치즈")).toBe("치즈");
  });

  it("folds nothing out of nothing", () => {
    expect(normalizeGroceryName(null)).toBe("");
    expect(normalizeGroceryName("   ")).toBe("");
  });
});

describe("nameWords", () => {
  it("counts the words the auto-link rule looks for", () => {
    expect(nameWords("Oude  Kaas!")).toEqual(["oude", "kaas"]);
    expect(nameWords("")).toEqual([]);
  });
});
