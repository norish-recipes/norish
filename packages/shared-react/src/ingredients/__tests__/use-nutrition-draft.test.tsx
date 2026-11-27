import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IngredientNutrition } from "@norish/shared/contracts/ingredient-nutrition";

const held = vi.hoisted(() => ({ correct: vi.fn(), remove: vi.fn() }));

vi.mock("../use-ingredient-nutrition", () => ({
  useNutritionCorrection: () => held,
  useNutritionFoodsQuery: () => ({ foods: [], isFetching: false }),
}));

const { useNutritionDraft } = await import("../use-nutrition-draft");

const own: IngredientNutrition = {
  numbers: {
    value: { kcal: 53, fat: 0, carbs: 5, protein: 8 },
    source: { kind: "household" },
    borrowedFrom: null,
  },
  pieceWeight: null,
  density: null,
};

const setUp = (current: IngredientNutrition | null, onClose = vi.fn()) =>
  renderHook(() => useNutritionDraft({ ingredientId: "i", current, measure: null, onClose }));

describe("useNutritionDraft", () => {
  it("starts every fact on the sources, where nothing is corrected, and cannot save that", () => {
    const { result } = setUp(null);

    expect(result.current.corrected).toBe(false);
    expect(result.current.nothing).toBe(true);
    expect(result.current.canSave).toBe(false);
    expect(result.current.facts).toEqual(["numbers", "pieceWeight"]);
  });

  it("starts a household's own numbers as a label, and removing them is its own action", () => {
    const onClose = vi.fn();
    const { result } = setUp(own, onClose);

    expect(result.current.corrected).toBe(true);
    expect(result.current.draft.numbers).toMatchObject({
      mode: "label",
      typed: ["53", "0", "5", "8"],
    });
    act(() => result.current.removeAll());
    expect(held.remove).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("saves typed label numbers once every field is a number, and not before", () => {
    const { result } = setUp(null);

    act(() => result.current.set("numbers", { mode: "label", typed: ["10", "1", "2"] }));
    expect(result.current.complete).toBe(false);
    act(() => result.current.set("numbers", { mode: "label", typed: ["10", "1", "2", "3,5"] }));
    expect(result.current.canSave).toBe(true);
    act(() => result.current.save());
    expect(held.correct).toHaveBeenCalledWith(
      expect.objectContaining({ numbers: { kcal: 10, fat: 1, carbs: 2, protein: 3.5 } }),
      expect.objectContaining({
        numbers: expect.objectContaining({ source: { kind: "household" } }),
      })
    );
  });

  it("refuses a mass per 100 g above 100 g, and says which fact has one", () => {
    const { result } = setUp(null);

    act(() => result.current.set("numbers", { mode: "label", typed: ["900", "111", "0", "0"] }));
    expect(result.current.canSave).toBe(false);
    expect(result.current.overHundred).toEqual(["numbers"]);
    act(() => result.current.set("numbers", { mode: "label", typed: ["900", "100", "0", "0"] }));
    expect(result.current.canSave).toBe(true);
    expect(result.current.overHundred).toEqual([]);
  });
});
