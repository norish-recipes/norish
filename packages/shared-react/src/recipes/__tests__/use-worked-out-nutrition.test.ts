/** A recipe's worked-out nutrition: loading while its inputs read, apart from having none. */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkedOutNutrition } from "../use-worked-out-nutrition";

const state = vi.hoisted(() => ({
  readings: {} as Record<string, unknown> | undefined,
  numbers: undefined as Record<string, unknown> | undefined,
  numbersLoading: false,
}));

vi.mock("../use-line-readings", () => ({ useLineReadings: () => state.readings }));
vi.mock("../../config", () => ({
  useUnitsQuery: () => ({ units: {} }),
  useSpellingRules: () => undefined,
}));
vi.mock("../../trpc", () => ({
  useTRPC: () => ({ ingredients: { nutritionFor: { queryOptions: () => ({}) } } }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: state.numbers, isLoading: state.numbersLoading }),
}));

const recipe = {
  id: "r1",
  servings: 1,
  systemUsed: "metric",
  calories: null,
  fat: null,
  carbs: null,
  protein: null,
  recipeIngredients: [
    {
      id: "l1",
      ingredientName: "rice",
      ingredientId: "rice",
      amount: 100,
      unit: "gram",
      systemUsed: "metric",
    },
  ],
};

describe("useWorkedOutNutrition", () => {
  beforeEach(() => {
    state.readings = {};
    state.numbers = undefined;
    state.numbersLoading = false;
  });

  it("is loading while the readings read", () => {
    state.readings = undefined;

    expect(renderHook(() => useWorkedOutNutrition(recipe)).result.current).toEqual({
      nutrition: null,
      isLoading: true,
    });
  });

  it("is loading while the foods' numbers read", () => {
    state.numbersLoading = true;

    expect(renderHook(() => useWorkedOutNutrition(recipe)).result.current.isLoading).toBe(true);
  });

  it("has none, not loading, where the numbers could not be read", () => {
    expect(renderHook(() => useWorkedOutNutrition(recipe)).result.current).toEqual({
      nutrition: null,
      isLoading: false,
    });
  });
});
