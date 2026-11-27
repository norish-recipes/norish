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
  send: undefined as unknown as ReturnType<typeof vi.fn>,
  bring: false,
  providerLoading: false,
}));

vi.mock("../../config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");
  const units = (await import("@norish/config/units.default.json")).default;

  return {
    useSpellingRules: () => spellingRules(units as UnitsMap),
    useGroceryListProvider: () => ({ isBring: state.bring, isLoading: state.providerLoading }),
    useUnitsQuery: () => ({ units }),
  };
});
vi.mock("../use-send-to-bring", () => ({ useSendToBring: () => state.send }));
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
  edited: Record<string, { name: string; amount: number | null; unit: string | null }> = {},
  source?: { recipeId: string; servings: number; locale?: string }
) {
  const adapter = fakePlatformAdapter();
  const wrapper = createTestWrapper(createTestQueryClient(), adapter);
  const view = renderHook(() => useLinesToBuy(foodsToBuy(state.lines), edited, source), {
    wrapper,
  });

  return { ...view, adapter };
}

describe("useLinesToBuy", () => {
  beforeEach(() => {
    state.create = vi.fn(async () => undefined);
    state.keep = vi.fn(async () => "kept");
    state.send = vi.fn(async () => true);
    state.bring = false;
    state.providerLoading = false;
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

  describe("addLines where the list is Bring!", () => {
    beforeEach(() => {
      state.bring = true;
    });

    it("sends the lines as edited here for the recipe and servings, and never to the built-in list", async () => {
      const { result, adapter } = setup(
        { "l-chicken": { name: "chicken thighs", amount: 3, unit: "pcs" } },
        { recipeId: "r1", servings: 4 }
      );

      let added: boolean | undefined;

      await act(async () => {
        added = await result.current.addLines(result.current.toBuy);
      });

      expect(added).toBe(true);
      expect(state.send).toHaveBeenCalledWith(
        [{ name: "chicken thighs", amount: 3, unit: "pcs" }],
        { recipeId: "r1", servings: 4 }
      );
      expect(state.create).not.toHaveBeenCalled();
      expect(adapter.toast.show).not.toHaveBeenCalled();
    });

    it("still sends, with no recipe, when it is not told the source", async () => {
      const { result } = setup();

      await act(async () => {
        await result.current.addLines(result.current.toBuy);
      });

      expect(state.send).toHaveBeenCalledWith(
        [{ name: "chicken breast", amount: 500, unit: "g" }],
        { recipeId: undefined, servings: undefined }
      );
    });

    it("sends once however often it is called", async () => {
      const { result } = setup({}, { recipeId: "r1", servings: 2 });

      await act(async () => {
        await Promise.all([
          result.current.addLines(result.current.toBuy),
          result.current.addLines(result.current.toBuy),
        ]);
      });

      expect(state.send).toHaveBeenCalledTimes(1);
      expect(result.current.isAdding).toBe(true);
    });

    it("lets the person try again when Bring! did not take the lines", async () => {
      state.send = vi.fn(async () => false);
      const { result } = setup({}, { recipeId: "r1", servings: 2 });
      let added: boolean | undefined;

      await act(async () => {
        added = await result.current.addLines(result.current.toBuy);
      });
      expect(added).toBe(false);
      expect(result.current.isAdding).toBe(false);
      await act(async () => {
        await result.current.addLines(result.current.toBuy);
      });

      expect(state.send).toHaveBeenCalledTimes(2);
    });
  });

  describe("the units sent to Bring!", () => {
    const sentLines = async (locale: string) => {
      state.pantry = [];
      state.lines = [
        line("l-flour", "flour", 250, { unit: "gram" }),
        line("l-milk", "milk", 0.5, { unit: "liter" }),
        line("l-eggs", "eggs", 3, { unit: null }),
        line("l-salt", "salt", 1, { unit: "pinch" }),
      ];
      const { result } = setup({}, { recipeId: "r1", servings: 2, locale });

      await act(async () => {
        await result.current.addLines(result.current.toBuy);
      });

      return (
        state.send.mock.calls[0]![0] as { amount: number; unit: string | null; name: string }[]
      ).map((item) => [item.amount, item.unit, item.name]);
    };

    beforeEach(() => {
      state.bring = true;
    });

    it("writes units short, in the reader's language, not as the stored canonical id (en)", async () => {
      expect(await sentLines("en")).toEqual([
        [250, "g", "flour"],
        [0.5, "l", "milk"],
        [3, null, "eggs"],
        [1, "pinch", "salt"],
      ]);
    });

    it("writes them in German for a German reader", async () => {
      expect(await sentLines("de")).toEqual([
        [250, "g", "flour"],
        [0.5, "l", "milk"],
        [3, null, "eggs"],
        [1, "Prise", "salt"],
      ]);
    });

    it("leaves a unit it does not know as it is, and formats an edited unit the same way", async () => {
      state.pantry = [];
      const { result } = setup(
        {
          "l-chicken": { name: "chicken", amount: 2, unit: "gram" },
          "l-oil": { name: "oil", amount: 1, unit: "bottle-ish" },
        },
        { recipeId: "r1", servings: 2, locale: "en" }
      );

      await act(async () => {
        await result.current.addLines([...result.current.toBuy, ...result.current.inPantry]);
      });

      expect((state.send.mock.calls[0]![0] as { unit: string }[]).map((item) => item.unit)).toEqual(
        ["bottle-ish", "g"]
      );
    });
  });

  describe("before the instance has said which list this is", () => {
    it("adds nothing, to either list, and does not use up the one add", async () => {
      state.providerLoading = true;
      const { result, rerender } = setup();

      let added: boolean | undefined;

      await act(async () => {
        added = await result.current.addLines(result.current.toBuy);
      });

      expect(added).toBe(false);
      expect(state.create).not.toHaveBeenCalled();
      expect(state.send).not.toHaveBeenCalled();
      expect(result.current.isAdding).toBe(false);
      expect(result.current.isProviderLoading).toBe(true);

      state.providerLoading = false;
      rerender();
      await act(async () => {
        await result.current.addLines(result.current.toBuy);
      });

      expect(state.create).toHaveBeenCalledTimes(1);
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
