import { describe, expect, it, vi } from "vitest";

import { parseMelaRecipeToDTO } from "@norish/shared-server/archive/mela-parser";
import { BUILT_IN_CATEGORIES } from "@norish/shared/lib/categories";

// @vitest-environment node

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: vi.fn().mockResolvedValue("mocked-image-guid"),
}));

const RECIPE_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("Mela Parser", () => {
  it("keeps the source's Headings in the ingredients and the steps", async () => {
    const dto = await parseMelaRecipeToDTO(
      {
        title: "Tiramisù",
        ingredients: "Per la crema:\n3 eggs\nSAVOIARDI\n# Per servire\ncocoa",
        instructions: "Crema:\nWhisk the eggs with the sugar until pale and thick.",
      },
      RECIPE_ID,
      BUILT_IN_CATEGORIES
    );

    expect(dto.recipeIngredients.map((line) => line.ingredientName)).toEqual([
      "# Per la crema",
      "eggs",
      // Capitals alone never make a Heading: this is a real ingredient.
      "SAVOIARDI",
      "# Per servire",
      "cocoa",
    ]);
    expect(dto.recipeIngredients[0]).toMatchObject({ amount: null, unit: null, order: 0 });
    expect(dto.steps.map((step) => step.step)).toEqual([
      "# Crema",
      "Whisk the eggs with the sugar until pale and thick.",
    ]);
  });

  it("makes a matched category a Category, keeping every name a Tag", async () => {
    const dto = await parseMelaRecipeToDTO(
      { title: "Margarita", ingredients: "tequila", categories: ["Drinks", "Supper", "Holiday"] },
      RECIPE_ID,
      [...BUILT_IN_CATEGORIES, "Drinks"]
    );

    expect(dto.categories).toEqual(["Drinks", "Dinner"]);
    expect(dto.tags!.map((tag) => tag.name)).toEqual(["Drinks", "Supper", "Holiday"]);
  });

  it("keeps a long step ending in a colon as a step", async () => {
    const step = "Whisk the eggs with the sugar, then fold in the following:";
    const dto = await parseMelaRecipeToDTO(
      { title: "Tiramisù", ingredients: "3 eggs", instructions: step },
      RECIPE_ID,
      BUILT_IN_CATEGORIES
    );

    expect(dto.steps.map((s) => s.step)).toEqual([step]);
  });
});
