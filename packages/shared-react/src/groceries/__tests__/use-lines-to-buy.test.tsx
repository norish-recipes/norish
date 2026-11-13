/**
 * What a recipe puts on the groceries list: its lines at the servings picked, the Pantry's apart,
 * and the names, amounts and ids that go on the list.
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import type { GroceryIngredient } from "@norish/shared/lib/grocery-lines";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";
import { foodsToBuy } from "@norish/shared/lib/line-foods";

import { useLinesToBuy } from "../use-lines-to-buy";

const state = vi.hoisted(() => ({
  pantry: [] as unknown[],
  lines: [] as GroceryIngredient[],
  create: undefined as unknown as ReturnType<typeof vi.fn>,
  keep: undefined as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("../../config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");
  const units = (await import("@norish/config/units.default.json")).default;

  return { useSpellingRules: () => spellingRules(units as UnitsMap) };
});
vi.mock("../use-groceries-mutations", () => ({
  useGroceriesMutations: () => ({ createGroceriesFromData: state.create }),
}));
vi.mock("../use-pantry-mutations", () => ({
  usePantryMutations: () => ({ addPantryIngredient: state.keep }),
}));
vi.mock("../use-pantry-query", () => ({
  usePantryQuery: () => ({ items: state.pantry, isLoading: false }),
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

const kept = (name: string): PantryIngredientDto => ({
  id: `p-${name}`,
  userId: "u1",
  ingredientId: `i-${name}`,
  name,
  version: 1,
  ancestorIds: [],
  localeNames: {},
});

function setup(
  edited: Record<string, { name: string; amount: number | null; unit: string | null }> = {}
) {
  const adapter = fakePlatformAdapter();
  const wrapper = createTestWrapper(createTestQueryClient(), adapter);
  const view = renderHook(() => useLinesToBuy(foodsToBuy(state.lines), edited), { wrapper });

  return { ...view, adapter };
}

describe("useLinesToBuy", () => {
  beforeEach(() => {
    state.create = vi.fn(async () => undefined);
    state.keep = vi.fn(async () => "kept");
    state.lines = [line("l-oil", "olive oil", 2), line("l-chicken", "chicken breast", 500)];
    state.pantry = [kept("olive oil")];
  });

  it("splits the lines by whether the Pantry holds them", () => {
    const { result } = setup();

    expect(result.current.toBuy.map((item) => item.id)).toEqual(["l-chicken"]);
    expect(result.current.inPantry.map((item) => item.id)).toEqual(["l-oil"]);
  });

  it("matches a line by the name as edited here", () => {
    const { result } = setup({ "l-chicken": { name: "olive oil", amount: 1, unit: "g" } });

    expect(result.current.inPantry.map((item) => item.id)).toEqual(["l-oil", "l-chicken"]);
  });

  describe("a line naming several foods", () => {
    const several = (id: string, text: string, joined: string, foods: string[]) =>
      line(id, text, 2, {
        ingredientId: `i-${foods[0]}`,
        unit: "el",
        joined,
        foods: foods.map((name) => ({ ingredientId: `i-${name}`, name })),
      });

    it("adds each food of an and line at the line's amount, and an or line's first", async () => {
      state.pantry = [];
      state.lines = [
        several("l-bake", "boter en suiker", "together", ["boter", "suiker"]),
        several("l-fry", "boter of olie", "alternatives", ["boter", "olie"]),
      ];
      const { result } = setup();

      await act(async () => {
        await result.current.addLines(result.current.toBuy);
      });

      expect(state.create.mock.calls[0]![0]).toEqual([
        expect.objectContaining({
          name: "boter",
          amount: 2,
          unit: "el",
          recipeIngredientId: "l-bake",
        }),
        expect.objectContaining({
          name: "suiker",
          amount: 2,
          unit: "el",
          recipeIngredientId: "l-bake",
        }),
        expect.objectContaining({ name: "boter", recipeIngredientId: "l-fry" }),
      ]);
    });

    it("keeps an or line in the Pantry when any food is kept, and an and line food by food", () => {
      state.pantry = [kept("olie"), kept("zout")];
      state.lines = [
        several("l-fry", "boter of olie", "alternatives", ["boter", "olie"]),
        several("l-season", "zout en peper", "together", ["zout", "peper"]),
      ];
      const { result } = setup();

      expect(result.current.inPantry.map((item) => item.ingredientName)).toEqual(["boter", "zout"]);
      expect(result.current.toBuy.map((item) => item.ingredientName)).toEqual(["peper"]);
    });
  });

  describe("addLines", () => {
    it("puts the lines on the list as edited here, in the order given, and says so", async () => {
      const { result, adapter } = setup({
        "l-chicken": { name: "chicken thighs", amount: 3, unit: "pcs" },
      });

      let added: boolean | undefined;

      await act(async () => {
        added = await result.current.addLines(result.current.toBuy);
      });

      expect(added).toBe(true);
      expect(state.create.mock.calls[0]![0]).toEqual([
        {
          name: "chicken thighs",
          amount: 3,
          unit: "pcs",
          isDone: false,
          recipeIngredientId: "l-chicken",
        },
      ]);
      expect(adapter.toast.show).toHaveBeenCalledWith({
        severity: "success",
        title: "groceries.panel.ingredientsAdded",
      });
    });

    it("adds once however often it is called, and shows it is adding", async () => {
      const { result } = setup();

      await act(async () => {
        await Promise.all([
          result.current.addLines(result.current.toBuy),
          result.current.addLines(result.current.toBuy),
        ]);
      });

      expect(state.create).toHaveBeenCalledTimes(1);
      expect(result.current.isAdding).toBe(true);
    });

    it("lets the person try again after the list refused", async () => {
      state.create = vi.fn(async () => {
        throw new Error("no");
      });
      const { result } = setup();

      await act(async () => {
        await result.current.addLines(result.current.toBuy);
      });
      expect(result.current.isAdding).toBe(false);
      await act(async () => {
        await result.current.addLines(result.current.toBuy);
      });

      expect(state.create).toHaveBeenCalledTimes(2);
    });

    it("answers false and warns when the list refuses", async () => {
      state.create = vi.fn(async () => {
        throw new Error("no");
      });
      const { result, adapter } = setup();

      let added: boolean | undefined;

      await act(async () => {
        added = await result.current.addLines(result.current.toBuy);
      });

      expect(added).toBe(false);
      expect(adapter.toast.show).toHaveBeenCalledWith({
        severity: "warning",
        title: "groceries.panel.ingredientsFailed",
      });
    });
  });

  describe("keepLine", () => {
    it("keeps a line's own food", () => {
      const { result } = setup();

      act(() => result.current.keepLine(result.current.toBuy[0]!));

      expect(state.keep).toHaveBeenCalledWith({
        ingredientId: "i-chicken breast",
        name: "chicken breast",
      });
    });

    it("keeps the food of the name as edited here", () => {
      const { result } = setup({ "l-chicken": { name: "chicken thighs", amount: 500, unit: "g" } });

      act(() => result.current.keepLine(result.current.toBuy[0]!));

      expect(state.keep).toHaveBeenCalledWith("chicken thighs");
    });
  });
});
