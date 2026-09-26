// @vitest-environment node
/**
 * Grocery names through Ingredient Aliases, against a real database: a line
 * typed by hand and a line added from a recipe are recognised the same way,
 * and each keeps its own text.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createRecipeWithRefs, getRecipeFull } from "@norish/db";
import { resolveGroceryNames } from "@norish/shared-server/ingredients/groceries";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

describe("grocery names through aliases", () => {
  const testBase = new RepositoryTestBase("test_grocery_aliases");

  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function recipeLine(text: string) {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(
      recipeId,
      userId,
      await withResolvedIngredients(
        {
          name: "Soup",
          systemUsed: "metric",
          recipeIngredients: [
            { ingredientId: null, ingredientName: text, amount: 1, unit: null, order: 0 },
          ],
        },
        { userId }
      )
    );

    return (await getRecipeFull(recipeId))!.recipeIngredients[0]!;
  }

  it("recognises a name typed by hand as the food a recipe line names", async () => {
    const line = await recipeLine("onions, diced");
    const [typed] = await resolveGroceryNames([{ name: "Onions" }], { userId });

    expect(typed?.ingredientId).toBe(line.ingredientId);
  });

  it("gives a grocery added from a recipe line that line's alias", async () => {
    const line = await recipeLine("onions, diced");
    const [fromRecipe, typed] = await resolveGroceryNames(
      [{ name: "onions, diced", recipeIngredientId: line.id }, { name: "onions, diced" }],
      { userId }
    );

    expect(fromRecipe).toEqual(typed);
    expect(fromRecipe?.ingredientId).toBe(line.ingredientId);
  });

  it("resolves the text of a recipe line renamed on its way to the list", async () => {
    const line = await recipeLine("olive oil");
    const [renamed] = await resolveGroceryNames(
      [{ name: "extra virgin olive oil", recipeIngredientId: line.id }],
      { userId }
    );

    expect(renamed?.ingredientId).not.toBe(line.ingredientId);
  });

  it("has nothing to resolve for a grocery with no name", async () => {
    await expect(
      resolveGroceryNames([{ name: null }, { name: "  " }], { userId })
    ).resolves.toEqual([null, null]);
  });
});
