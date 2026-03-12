// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { buildRecipeDTO } from "@norish/api/importers/parser-helpers";

vi.mock("@norish/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));

vi.mock("@norish/shared/lib/helpers", async (importOriginal) => {
  const original = await importOriginal<typeof import("@norish/shared/lib/helpers")>();

  return {
    ...original,
    parseIngredientWithDefaults: vi.fn((lines: string[]) =>
      lines.map((line) => ({
        quantity: null,
        unitOfMeasureID: null,
        description: line.includes("Header") ? "" : line,
        isGroupHeader: false,
      }))
    ),
  };
});

describe("buildRecipeDTO", () => {
  it("filters parsed ingredients with empty names", async () => {
    const dto = await buildRecipeDTO({
      name: "Header Recipe",
      ingredientsText: "1 cup quinoa\nHeader section",
      instructionsText: "Mix well",
    });
    const ingredients = dto.recipeIngredients || [];

    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]?.ingredientName).toBe("1 cup quinoa");
  });
});
