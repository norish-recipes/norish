// @vitest-environment node
/**
 * The measure an Ingredient's spoon weight is shown in (ADR-0039, ticket 17):
 * the volume measure the viewer's recipes use most for it, counted over the
 * recipes the recipe list would show them, or none where no recipe measures
 * it by volume.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { RecipeListContext } from "@norish/db/repositories/recipes";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { deleteConfig, setConfig } from "@norish/db/repositories/server-config";
import { spoonMeasureFor } from "@norish/shared-server/ingredients/nutrition/spoon-measure";

import {
  createTestIngredient,
  createTestRecipe,
  createTestRecipeIngredients,
  createTestUser,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

describe("the measure a spoon weight is shown in", () => {
  const testBase = new RepositoryTestBase("test_spoon_measure");
  let household: RecipeListContext;
  let housemateId: string;
  let strangerId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [owner] = await testBase.beforeEachTest();

    housemateId = (await createTestUser({ name: "Housemate" }))!.id;
    strangerId = (await createTestUser({ name: "Stranger" }))!.id;
    household = {
      userId: owner.id,
      householdUserIds: [owner.id, housemateId],
      isServerAdmin: false,
    };
    await setConfig(
      ServerConfigKeys.RECIPE_PERMISSION_POLICY,
      { view: "household", edit: "household", delete: "household" },
      null,
      false
    );
  });

  afterAll(async () => {
    await deleteConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY);
    await testBase.teardown();
  });

  /** A recipe of `userId`'s with these lines of one food: [amount, unit, system]. */
  async function recipeOf(
    userId: string,
    ingredientId: string,
    lines: Array<[string, string, "metric" | "us"?]>
  ) {
    const recipe = await createTestRecipe(userId);

    for (const [index, [amount, unit, system]] of lines.entries()) {
      await createTestRecipeIngredients(recipe.id, ingredientId, system ?? "metric", {
        amount,
        unit,
        order: String(index),
      });
    }
  }

  it("is the volume measure the household's recipes use most for the food", async () => {
    const cumin = (await createTestIngredient({ name: "cumin" }))!;

    await recipeOf(household.userId, cumin.id, [["1", "teaspoon"]]);
    await recipeOf(housemateId, cumin.id, [
      ["2", "teaspoon"],
      ["1", "cup"],
    ]);

    await expect(spoonMeasureFor(household, cumin.id)).resolves.toBe("teaspoon");
  });

  it("counts only the recipes the household can open", async () => {
    const cumin = (await createTestIngredient({ name: "cumin" }))!;

    await recipeOf(household.userId, cumin.id, [["1", "teaspoon"]]);
    await recipeOf(strangerId, cumin.id, [
      ["1", "cup"],
      ["2", "cup"],
    ]);

    await expect(spoonMeasureFor(household, cumin.id)).resolves.toBe("teaspoon");
    await expect(
      spoonMeasureFor(
        { userId: strangerId, householdUserIds: null, isServerAdmin: false },
        cumin.id
      )
    ).resolves.toBe("cup");
  });

  it("reads millilitres to litres per 100 ml, and only the recipe's own measurement system", async () => {
    const milk = (await createTestIngredient({ name: "milk" }))!;

    await recipeOf(household.userId, milk.id, [
      ["250", "milliliter"],
      ["1", "cup", "us"],
      ["2", "cup", "us"],
    ]);
    await recipeOf(housemateId, milk.id, [["1", "liter"]]);

    await expect(spoonMeasureFor(household, milk.id)).resolves.toBe("100ml");
  });

  it("goes to the smaller measure on a tie", async () => {
    const milk = (await createTestIngredient({ name: "milk" }))!;

    await recipeOf(household.userId, milk.id, [["1", "cup"]]);
    await recipeOf(housemateId, milk.id, [["250", "milliliter"]]);

    await expect(spoonMeasureFor(household, milk.id)).resolves.toBe("100ml");
  });

  it("reads every line of a recipe with none in its own measurement system, as its total does", async () => {
    const flour = (await createTestIngredient({ name: "flour" }))!;

    await recipeOf(household.userId, flour.id, [["1", "cup", "us"]]);

    await expect(spoonMeasureFor(household, flour.id)).resolves.toBe("cup");
  });

  it("is none where no recipe measures the food by volume", async () => {
    const onion = (await createTestIngredient({ name: "onion" }))!;

    await recipeOf(household.userId, onion.id, [
      ["2", "piece"],
      ["200", "gram"],
    ]);

    await expect(spoonMeasureFor(household, onion.id)).resolves.toBeNull();

    await recipeOf(housemateId, onion.id, [["1", "cup"]]);

    await expect(spoonMeasureFor(household, onion.id)).resolves.toBe("cup");
  });
});
