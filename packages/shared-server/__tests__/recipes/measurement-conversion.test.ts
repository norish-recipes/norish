// @vitest-environment node
/**
 * A recipe converted without AI (#599): each line's food tells the arithmetic
 * its density and whether it is poured, a kind inheriting "poured" from any
 * food above it in the catalogue; steps keep their Step Ingredients and images.
 */
import { describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { convertRecipeMeasurements } from "@norish/shared-server/recipes/measurement-conversion";

const node = (id: string, offId: string | null, parentId: string | null = null) => ({
  id,
  name: id,
  offId,
  parentId,
  nutritionCodes: null,
});

vi.mock("@norish/db/repositories/ingredient-nutrition", () => ({
  findNutritionLineage: vi.fn(
    async () =>
      new Map(
        [
          node("flour", "en:wheat-flour"),
          node("oat-milk", "en:oat-milk"),
          node("milk", "en:milk", "dairy"),
          node("dairy", "en:dairy"),
          node("whole-milk", null, "milk"),
        ].map((n) => [n.id, n])
      )
  ),
}));

vi.mock("@norish/shared-server/ingredients/nutrition/ingredient-nutrition", () => ({
  resolveIngredientNutrition: vi.fn(
    async () =>
      new Map([
        ["flour", { numbers: null, pieceWeight: null, density: { value: 0.52 } }],
        ["whole-milk", { numbers: null, pieceWeight: null, density: { value: 1.02 } }],
      ])
  ),
}));

const line = (
  order: number,
  ingredientId: string | null,
  amount: number | null,
  unit: string | null
) => ({
  id: `line-${order}`,
  ingredientId,
  ingredientName: ingredientId ?? "# For the sauce",
  amount,
  unit,
  order,
  systemUsed: "us" as const,
  version: 1,
});

describe("convertRecipeMeasurements", () => {
  it("weighs what is not poured, pours what a parent pours, and carries steps over", async () => {
    const recipe = {
      recipeIngredients: [
        line(0, "flour", 2, "cup"),
        line(1, "whole-milk", 1, "cup"),
        line(2, null, null, null),
        line(3, "flour", 1, "tablespoon"),
      ],
      steps: [
        {
          step: "Bake at 350°F with 1 cup of the milk.",
          systemUsed: "us" as const,
          order: 0,
          version: 1,
          images: [{ id: "image-1", image: "/step.jpg", order: 0, version: 1 }],
          stepIngredients: [{ ingredientOrder: 1, share: 1, order: 0 }],
        },
      ],
    } satisfies Pick<FullRecipeDTO, "recipeIngredients" | "steps">;

    const converted = await convertRecipeMeasurements(recipe, "metric", { householdUserIds: [] });

    expect(converted.ingredients.map(({ amount, unit }) => [amount, unit])).toEqual([
      [250, "gram"],
      [240, "milliliter"],
      [null, null],
      [1, "tablespoon"],
    ]);
    expect(converted.ingredients.every((i) => i.systemUsed === "metric")).toBe(true);
    expect(converted.steps).toEqual([
      {
        step: "Bake at 175°C with 240 ml of the milk.",
        order: 0,
        systemUsed: "metric",
        images: [{ image: "/step.jpg", order: 0 }],
        stepIngredients: [{ ingredientOrder: 1, share: 1, order: 0 }],
      },
    ]);
  });
});
