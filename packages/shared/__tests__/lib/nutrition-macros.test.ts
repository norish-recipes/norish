import { describe, expect, it } from "vitest";

import { macroCalorieShares, percentOfReferenceIntake } from "@norish/shared/lib/nutrition-macros";

describe("macroCalorieShares", () => {
  it("weighs fat at nine calories a gram and the rest at four", () => {
    // 10g fat = 90 kcal, 10g carbs = 40 kcal, 10g protein = 40 kcal.
    const shares = macroCalorieShares({ fat: 10, carbs: 10, protein: 10 });

    expect(shares.map((entry) => [entry.key, entry.calories])).toEqual([
      ["fat", 90],
      ["carbs", 40],
      ["protein", 40],
    ]);
    expect(shares[0]!.share).toBeCloseTo(90 / 170);
  });

  it("is a calorie share, not a gram share", () => {
    const shares = macroCalorieShares({ fat: 10, carbs: 10, protein: 10 });

    // Equal grams, unequal arcs — which is the whole point.
    expect(shares[0]!.share).toBeGreaterThan(shares[1]!.share);
  });

  it("shares add up to one", () => {
    const shares = macroCalorieShares({ fat: 7, carbs: 31, protein: 12 });

    expect(shares.reduce((sum, entry) => sum + entry.share, 0)).toBeCloseTo(1);
  });

  it("draws only the macros a recipe stores", () => {
    const shares = macroCalorieShares({ fat: 10, protein: 10 });

    expect(shares.map((entry) => entry.key)).toEqual(["fat", "protein"]);
    expect(shares.reduce((sum, entry) => sum + entry.share, 0)).toBeCloseTo(1);
  });

  it("reads the strings the schema stores for macros", () => {
    const shares = macroCalorieShares({ fat: "10", carbs: "20", protein: null });

    expect(shares.map((entry) => entry.key)).toEqual(["fat", "carbs"]);
  });

  it("has no ring for a recipe with no macros", () => {
    expect(macroCalorieShares({})).toEqual([]);
    expect(macroCalorieShares({ fat: null, carbs: null, protein: null })).toEqual([]);
  });

  it("has no ring for macros that are all zero", () => {
    expect(macroCalorieShares({ fat: 0, carbs: 0, protein: 0 })).toEqual([]);
  });

  it("ignores a negative gram figure", () => {
    const shares = macroCalorieShares({ fat: -5, carbs: 10 });

    expect(shares.map((entry) => entry.key)).toEqual(["carbs"]);
  });
});

describe("percentOfReferenceIntake", () => {
  it("reads each amount against an adult's reference intake, rounded", () => {
    expect(percentOfReferenceIntake("calories", 500)).toBe(25);
    expect(percentOfReferenceIntake("fat", 7)).toBe(10);
    expect(percentOfReferenceIntake("sodium", 480)).toBe(20);
    expect(percentOfReferenceIntake("carbs", 84.1)).toBe(32);
  });
});
