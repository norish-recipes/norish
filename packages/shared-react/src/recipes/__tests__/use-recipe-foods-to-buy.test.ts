/** A recipe's foods to buy: its lines at the servings picked, the linked recipes' included. */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRecipeFoodsToBuy } from "../use-recipe-foods-to-buy";

const state = vi.hoisted(() => ({
  lines: [] as unknown[],
  linked: [] as unknown[],
  linkedAskedFor: [] as string[][],
}));

vi.mock("../use-recipe-ingredients", () => ({
  useRecipeIngredients: () => ({
    ingredients: state.lines,
    systemUsed: "metric",
    isLoading: false,
  }),
}));
vi.mock("../use-linked-recipe-ingredients", () => ({
  useLinkedRecipeIngredients: (ids: string[]) => {
    state.linkedAskedFor.push(ids);

    return { ingredients: state.linked, isLoading: false };
  },
}));

const line = (id: string, name: string, amount: number | null, over: object = {}) => ({
  id,
  ingredientId: `i-${name}`,
  ingredientName: name,
  amount,
  unit: amount === null ? null : "g",
  systemUsed: "metric",
  order: 0,
  ...over,
});

describe("useRecipeFoodsToBuy", () => {
  beforeEach(() => {
    state.lines = [line("l-oil", "olive oil", 2), line("l-chicken", "chicken breast", 500)];
    state.linked = [];
    state.linkedAskedFor = [];
  });

  it("scales the amounts to the servings picked", () => {
    const { result } = renderHook(() => useRecipeFoodsToBuy("r1", 2, 4));

    expect(result.current.scaledIngredients.map((item) => item.amount)).toEqual([4, 1000]);

    act(() => result.current.decrementServings());

    expect(result.current.servings).toBeLessThan(4);
    expect(result.current.scaledIngredients[1]!.amount).toBeLessThan(1000);
  });

  it("leaves out a line that names no food, such as a tool", () => {
    state.lines = [
      ...(state.lines as object[]),
      line("l-tin", "springvorm (26 cm)", null, { ingredientId: null }),
    ];
    const { result } = renderHook(() => useRecipeFoodsToBuy("r1", 2, 2));

    expect(result.current.scaledIngredients.map((item) => item.id)).toEqual(["l-oil", "l-chicken"]);
  });

  it("asks for the ingredients of each recipe a line links to, once", () => {
    state.lines = [
      line("i-sauce", "[Sauce](id:recipe-1)", null),
      line("i-two", "[Sauce](id:recipe-1) or [Pesto](id:recipe-2)", null),
    ];
    renderHook(() => useRecipeFoodsToBuy("r1", 2, 2));

    expect(state.linkedAskedFor.at(-1)).toEqual(["recipe-1", "recipe-2"]);
  });

  it("adds the linked recipes' lines", () => {
    state.linked = [line("l-pesto", "basil", 30)];
    const { result } = renderHook(() => useRecipeFoodsToBuy("r1", 2, 2));

    expect(result.current.scaledIngredients.map((item) => item.id)).toContain("l-pesto");
  });

  describe("a line naming several foods", () => {
    const several = (id: string, text: string, joined: string, foods: string[]) =>
      line(id, text, 2, {
        ingredientId: `i-${foods[0]}`,
        unit: "el",
        joined,
        foods: foods.map((name) => ({ ingredientId: `i-${name}`, name })),
      });

    it("has each food of an and line at the line's amount, and an or line's first", () => {
      state.lines = [
        several("l-bake", "boter en suiker", "together", ["boter", "suiker"]),
        several("l-fry", "boter of olie", "alternatives", ["boter", "olie"]),
      ];
      const { result } = renderHook(() => useRecipeFoodsToBuy("r1", 2, 2));

      expect(
        result.current.scaledIngredients.map(({ ingredientName, amount, lineId }) => ({
          ingredientName,
          amount,
          lineId,
        }))
      ).toEqual([
        { ingredientName: "boter", amount: 2, lineId: "l-bake" },
        { ingredientName: "suiker", amount: 2, lineId: "l-bake" },
        { ingredientName: "boter", amount: 2, lineId: "l-fry" },
      ]);
    });
  });
});
