import { describe, expect, it } from "vitest";

import { selectIngredientsForSystem } from "../src/hooks/recipes/recipe/use-recipe-ingredients";

const metricButter = { id: "1", ingredientName: "butter", systemUsed: "metric" };
const usButter = { id: "2", ingredientName: "butter", systemUsed: "us" };
const metricFlour = { id: "3", ingredientName: "flour", systemUsed: "metric" };

describe("selectIngredientsForSystem", () => {
  it("keeps only the preferred system so ingredients never show once per system", () => {
    expect(selectIngredientsForSystem([metricButter, usButter, metricFlour], "metric", "us")).toEqual([
      metricButter,
      metricFlour,
    ]);
  });

  it("falls back to the recipe's own system when the preferred one is absent", () => {
    expect(selectIngredientsForSystem([usButter], "metric", "us")).toEqual([usButter]);
  });

  it("falls back to whichever system is available when neither matches", () => {
    expect(selectIngredientsForSystem([usButter], "metric", null)).toEqual([usButter]);
  });

  it("returns an empty list for empty input", () => {
    expect(selectIngredientsForSystem([], "metric", "metric")).toEqual([]);
  });
});
