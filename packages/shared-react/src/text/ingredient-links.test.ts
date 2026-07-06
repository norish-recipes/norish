import { describe, expect, it } from "vitest";

import {
  applyIngredientLinkMarkup,
  createIngredientLinkCandidates,
  formatIngredientLinkAmount,
  formatIngredientLinkToken,
  getIngredientLinkCandidateKey,
  parseIngredientLinkHref,
} from "./ingredient-links";

const ingredients = [
  { ingredientName: "Salt", amount: 1, unit: "tsp", systemUsed: "metric", order: 0 },
  { ingredientName: "Ground black pepper", amount: 2, unit: "g", systemUsed: "metric", order: 1 },
  { ingredientName: "# Sauce", systemUsed: "metric", order: 2 },
  { ingredientName: "Butter", systemUsed: "us", order: 3 },
  { ingredientName: "salt", systemUsed: "metric", order: 4 },
];

describe("ingredient links", () => {
  it("creates active-system candidates and excludes headings and duplicates", () => {
    const candidates = createIngredientLinkCandidates(ingredients, "metric");

    expect(candidates.map((candidate) => candidate.ingredientName)).toEqual([
      "Salt",
      "Ground black pepper",
    ]);
    expect(candidates.map((candidate) => candidate.key)).toEqual([
      "metric:salt",
      "metric:ground black pepper",
    ]);
  });

  it("formats single-word and multi-word tokens", () => {
    expect(formatIngredientLinkToken("salt")).toBe("@salt");
    expect(formatIngredientLinkToken("ground black pepper")).toBe("@ground black pepper{}");
    expect(formatIngredientLinkToken("salt", "1 tsp")).toBe("@salt{1 tsp}");
    expect(formatIngredientLinkToken("ground black pepper", "2 g")).toBe(
      "@ground black pepper{2 g}"
    );
  });

  it("formats ingredient link amounts", () => {
    expect(formatIngredientLinkAmount({ amount: 1, unit: "tsp" })).toBe("1 tsp");
    expect(formatIngredientLinkAmount({ amount: 1.5, unit: "cup" })).toBe("1.5 cup");
    expect(formatIngredientLinkAmount({ amount: null, unit: "to taste" })).toBe("to taste");
  });

  it("links single-word ingredient markers", () => {
    const candidates = createIngredientLinkCandidates(ingredients, "metric");

    expect(applyIngredientLinkMarkup("Season with @salt.", candidates)).toBe(
      "Season with [Salt](norish-ingredient:metric%3Asalt)."
    );
  });

  it("links braced multi-word ingredient markers", () => {
    const candidates = createIngredientLinkCandidates(ingredients, "metric");

    expect(applyIngredientLinkMarkup("Add @ground black pepper{}.", candidates)).toBe(
      "Add [Ground black pepper](norish-ingredient:metric%3Aground%20black%20pepper)."
    );
    expect(applyIngredientLinkMarkup("Add @ground black pepper{2 g}.", candidates)).toBe(
      "Add [Ground black pepper (2 g)](norish-ingredient:metric%3Aground%20black%20pepper)."
    );
    expect(applyIngredientLinkMarkup("Add @salt{1 tsp}.", candidates)).toBe(
      "Add [Salt (1 tsp)](norish-ingredient:metric%3Asalt)."
    );
  });

  it("keeps unknown markers as plain text", () => {
    const candidates = createIngredientLinkCandidates(ingredients, "metric");

    expect(applyIngredientLinkMarkup("Add @sugar and @brown sugar{}.", candidates)).toBe(
      "Add @sugar and @brown sugar{}."
    );
    expect(applyIngredientLinkMarkup("Use @salt flakes{}.", candidates)).toBe(
      "Use @salt flakes{}."
    );
  });

  it("supports escaped literal at signs", () => {
    const candidates = createIngredientLinkCandidates(ingredients, "metric");

    expect(applyIngredientLinkMarkup("Use \\@salt literally.", candidates)).toBe(
      "Use @salt literally."
    );
  });

  it("does not link email-like at signs", () => {
    const candidates = createIngredientLinkCandidates(
      [{ ingredientName: "example", systemUsed: "metric", order: 0 }],
      "metric"
    );

    expect(applyIngredientLinkMarkup("mail test@example.com", candidates)).toBe(
      "mail test@example.com"
    );
  });

  it("round-trips href keys", () => {
    const key = getIngredientLinkCandidateKey({
      ingredientName: "Ground black pepper",
      systemUsed: "metric",
    });

    expect(parseIngredientLinkHref(`norish-ingredient:${encodeURIComponent(key)}`)).toBe(key);
  });
});
