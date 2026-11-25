// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setActiveSystemForRecipe, writeConvertedCopy } from "@norish/db";

import { recipesRouter } from "../../src/routers/recipes";
import { resetPermissionsMocks } from "../mocks/permissions";
import { recipes } from "../mocks/realtime/recipes";
import { everyRecipeIn, getRecipeFull } from "../mocks/recipes-repository";
import { createMockAuthedContext, createMockFullRecipe, createMockUser } from "./test-utils";

vi.mock("@norish/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/db")>()),
  getRecipeFull: (await import("../mocks/recipes-repository")).getRecipeFull,
  getRecipeHouseholdIds: (await import("../mocks/recipes-repository")).getRecipeHouseholdIds,
  setActiveSystemForRecipe: vi.fn(),
  writeConvertedCopy: vi.fn(),
}));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/realtime/recipes", () => import("../mocks/realtime/recipes"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));
vi.mock("@norish/shared-server/ingredients/resolver", () => import("../mocks/ingredient-resolver"));
vi.mock("@norish/shared-server/ingredients/recipe-lines", () => ({
  withResolvedIngredients: async (input: object) => ({
    ...input,
    ingredientResolutions: new Map(),
  }),
}));
vi.mock("@norish/shared-server/ai/enrichment/unit-converter", () => ({
  convertRecipeDataWithAI: async () => ({
    steps: [],
    ingredients: [{ ingredientName: "Flour", amount: 2, unit: "cup", order: 0 }],
  }),
}));

const id = "55555555-5555-4555-8555-555555555555";

describe("convertMeasurements", () => {
  const ctx = createMockAuthedContext(createMockUser());
  const recipe = createMockFullRecipe({
    id,
    version: 4,
    systemUsed: "metric",
    originalSystem: null,
    recipeIngredients: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        ingredientId: null,
        ingredientName: "Flour",
        amount: 250,
        unit: "g",
        systemUsed: "metric",
        order: 0,
        version: 1,
      },
    ],
  });
  const convert = (targetSystem: "metric" | "us", withAI: boolean) =>
    recipesRouter
      .createCaller({ ...ctx, connectionId: null, operationId: null })
      .convertMeasurements({ recipeId: id, targetSystem, version: 3, withAI });

  beforeEach(() => {
    resetPermissionsMocks();
    everyRecipeIn(ctx.householdId);
    getRecipeFull.mockResolvedValue(recipe);
    vi.mocked(writeConvertedCopy).mockResolvedValue({ applied: false, stale: true });
    vi.mocked(setActiveSystemForRecipe).mockResolvedValue({ applied: false, stale: true });
  });

  it.each([
    ["writes a copy", "us", true],
    ["switches back", "metric", false],
  ] as const)(
    "settles a conversion that %s on a recipe edited since, changing nothing",
    async (_what, target, withAI) => {
      await convert(target, withAI);

      await vi.waitFor(() =>
        expect(recipes.publish).toHaveBeenCalledWith(
          "converted",
          { recipe, conversion: { target, withAI, version: 3 }, stale: true },
          expect.anything()
        )
      );
      if (withAI) {
        expect(writeConvertedCopy).toHaveBeenCalledWith(
          id,
          { from: "metric", to: "us" },
          3,
          [],
          expect.any(Array),
          expect.any(Map)
        );
        expect(setActiveSystemForRecipe).not.toHaveBeenCalled();
      }
    }
  );
});
