import { describe, expect, it } from "vitest";

import { storedNutrition } from "../utils/stored-nutrition";

describe("storedNutrition", () => {
  it("reads numbers and numeric strings", () => {
    expect(storedNutrition({ calories: 200, fat: "5.5", carbs: null, protein: null })).toEqual({
      calories: 200,
      fat: 5.5,
      carbs: null,
      protein: null,
    });
  });

  it("is null when the recipe stores none", () => {
    expect(storedNutrition({ calories: null, fat: "x", carbs: null, protein: null })).toBeNull();
  });
});
