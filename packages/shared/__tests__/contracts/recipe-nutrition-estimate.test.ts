import { describe, expect, it } from "vitest";

import { RecipeNutritionEstimateSchema } from "@norish/shared/contracts/zod";

describe("the language model's stored estimate on a recipe", () => {
  it("keeps each line's other nutrients through the recipe's output schema", () => {
    const line = {
      key: "carrot",
      calories: 8,
      fat: 0,
      carbs: 2,
      protein: 0,
      extras: { fiber: 0.9, sugars: 1.6, sodium: 23 },
    };

    expect(RecipeNutritionEstimateSchema.parse({ lines: [line] })).toEqual({ lines: [line] });
  });

  it("still reads an estimate stored before it knew other nutrients", () => {
    const line = { key: "carrot", calories: 8, fat: 0, carbs: 2, protein: 0 };

    expect(RecipeNutritionEstimateSchema.parse({ lines: [line] })).toEqual({ lines: [line] });
  });
});
