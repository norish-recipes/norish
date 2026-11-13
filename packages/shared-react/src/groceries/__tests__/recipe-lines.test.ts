import { describe, expect, it } from "vitest";

import type { GroceryIngredient } from "../recipe-lines";
import {
  extractLinkedRecipeIds,
  formatEditableIngredient,
  isGroceryIngredient,
  parseEditedIngredientLine,
} from "../recipe-lines";

const line = (over: Partial<GroceryIngredient> = {}): GroceryIngredient => ({
  id: "i1",
  ingredientId: "food-1",
  ingredientName: "olive oil",
  amount: 2,
  unit: "tbsp",
  systemUsed: "metric",
  order: 0,
  ...over,
});

describe("extractLinkedRecipeIds", () => {
  it("lists each recipe a line links to, once", () => {
    const ids = extractLinkedRecipeIds([
      line({ ingredientName: "[Sauce](id:recipe-1)" }),
      line({ ingredientName: "[Sauce](id:recipe-1) or [Pesto](id:recipe-2)" }),
      line({ ingredientName: "salt" }),
    ]);

    expect(ids).toEqual(["recipe-1", "recipe-2"]);
  });
});

describe("isGroceryIngredient", () => {
  it("keeps a line that names a food", () => {
    expect(isGroceryIngredient(line())).toBeTruthy();
  });

  it("leaves out headings, recipe links, tools and empty names", () => {
    expect(isGroceryIngredient(line({ ingredientName: "# For the sauce" }))).toBeFalsy();
    expect(isGroceryIngredient(line({ ingredientName: "[Sauce](id:recipe-1)" }))).toBeFalsy();
    expect(isGroceryIngredient(line({ ingredientId: null }))).toBeFalsy();
    expect(isGroceryIngredient(line({ ingredientName: "  " }))).toBeFalsy();
  });
});

describe("parseEditedIngredientLine", () => {
  it("reads amount, unit and name", () => {
    expect(parseEditedIngredientLine("500 g chicken thighs", line({ unit: "g" }))).toEqual({
      amount: 500,
      unit: "g",
      name: "chicken thighs",
    });
  });

  it("reads a fraction and a mixed number", () => {
    expect(parseEditedIngredientLine("1/2 tbsp oil", line())).toMatchObject({ amount: 0.5 });
    expect(parseEditedIngredientLine("1 1/2 tbsp oil", line())).toEqual({
      amount: 1.5,
      unit: "tbsp",
      name: "oil",
    });
  });

  it("keeps the line's amount and unit when the text starts with a name", () => {
    expect(parseEditedIngredientLine("chicken thighs", line({ amount: 3, unit: "g" }))).toEqual({
      amount: 3,
      unit: "g",
      name: "chicken thighs",
    });
  });

  it("takes no unit for a line that has none", () => {
    expect(parseEditedIngredientLine("2 eggs", line({ unit: null }))).toEqual({
      amount: 2,
      unit: null,
      name: "eggs",
    });
  });

  it("falls back to the line's name when only an amount is left", () => {
    expect(parseEditedIngredientLine("4", line({ unit: null }))).toMatchObject({
      amount: 4,
      name: "olive oil",
    });
  });
});

describe("formatEditableIngredient", () => {
  it("joins amount, unit and name, leaving out what is missing", () => {
    expect(formatEditableIngredient(line())).toBe("2 tbsp olive oil");
    expect(formatEditableIngredient(line({ amount: null, unit: null }))).toBe("olive oil");
  });
});
