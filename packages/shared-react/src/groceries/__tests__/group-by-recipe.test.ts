import { describe, expect, it } from "vitest";

import type { GroceryDto } from "@norish/shared/contracts";

import { groupGroceriesByRecipe } from "../group-by-recipe";

const line = (id: string, recipeIngredientId: string | null) =>
  ({ id, recipeIngredientId }) as unknown as GroceryDto;
const recipeMap = {
  r1: { recipeId: "taco", recipeName: "Tacos" },
  r2: { recipeId: "bowl", recipeName: "Bowls" },
  r3: { recipeId: "taco", recipeName: "Tacos" },
};

describe("groupGroceriesByRecipe", () => {
  it("puts the lines no recipe added first, then each recipe by name", () => {
    const groups = groupGroceriesByRecipe(
      [line("a", "r1"), line("b", null), line("c", "r2"), line("d", "r3"), line("e", "missing")],
      recipeMap,
      "Manual"
    );

    expect(groups.map((group) => [group.recipeId, group.recipeName])).toEqual([
      [null, "Manual"],
      ["bowl", "Bowls"],
      ["taco", "Tacos"],
    ]);
    expect(groups[0]?.groceries.map((grocery) => grocery.id)).toEqual(["b", "e"]);
    expect(groups[2]?.groceries.map((grocery) => grocery.id)).toEqual(["a", "d"]);
  });

  it("has no manual group where every line came from a recipe", () => {
    expect(groupGroceriesByRecipe([line("a", "r1")], recipeMap, "Manual")).toHaveLength(1);
    expect(groupGroceriesByRecipe([], recipeMap, "Manual")).toEqual([]);
  });
});
