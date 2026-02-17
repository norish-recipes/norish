// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));

vi.mock("parse-ingredient", () => ({
  parseIngredient: vi.fn((line: string) => {
    if (line.includes("Header")) {
      return [
        {
          quantity: null,
          unitOfMeasureID: null,
          description: "",
        },
      ];
    }

    return [
      {
        quantity: null,
        unitOfMeasureID: null,
        description: line,
      },
    ];
  }),
}));

import { buildRecipeDTO } from "@/server/importers/parser-helpers";

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
