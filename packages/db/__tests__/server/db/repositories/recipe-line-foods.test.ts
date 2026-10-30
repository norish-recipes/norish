// @vitest-environment node

import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getRecipeFull } from "@norish/db";
import { db } from "@norish/db/drizzle";
import { isFirstLineFood, writeRecipeLineFoodsTx } from "@norish/db/repositories/ingredients";
import * as schema from "@norish/db/schema";

import {
  createTestIngredient,
  createTestRecipe,
  createTestRecipeIngredients,
  createTestUser,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

/** A recipe line's foods: a list in order, of which a reader of "the line's food" reads the first. */
describe("a recipe line's foods", () => {
  const testBase = new RepositoryTestBase("test_recipe_line_foods");

  let recipeId: string;
  let lineId: string;
  let butter: { id: string; aliasId: string };
  let oil: { id: string; aliasId: string };

  async function food(name: string) {
    const ingredient = (await createTestIngredient({ name }))!;
    const [alias] = await db
      .select({ id: schema.ingredientAliases.id })
      .from(schema.ingredientAliases)
      .where(eq(schema.ingredientAliases.ingredientId, ingredient.id));

    return { id: ingredient.id, aliasId: alias!.id };
  }

  /** Writes the line's foods, in order. */
  const foods = (...list: Array<{ aliasId: string }>) =>
    db.transaction((tx) =>
      writeRecipeLineFoodsTx(tx, [{ id: lineId, aliasIds: list.map((f) => f.aliasId) }])
    );

  const line = async () => (await getRecipeFull(recipeId))!.recipeIngredients[0]!;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
    butter = await food("boter");
    oil = await food("olie");
    recipeId = (await createTestRecipe((await createTestUser())!.id)).id;
    lineId = (await createTestRecipeIngredients(recipeId, butter.id, "metric", {
      name: "boter of olie",
    }))!.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("reads the first food in order, as each write lists them", async () => {
    await foods(butter, oil);
    expect((await line()).ingredientId).toBe(butter.id);

    await foods(oil, butter);
    expect((await line()).ingredientId).toBe(oil.id);
  });

  it("keeps each line's first food under any name the table is read by", async () => {
    await foods(butter, oil);
    const f = alias(schema.recipeIngredientFoods, "f");

    await expect(
      db
        .select({ aliasId: f.ingredientAliasId })
        .from(f)
        .where(and(eq(f.recipeIngredientId, lineId), isFirstLineFood(f)))
    ).resolves.toEqual([{ aliasId: butter.aliasId }]);
    await expect(
      db
        .select({ aliasId: schema.recipeIngredientFoods.ingredientAliasId })
        .from(schema.recipeIngredientFoods)
        .where(and(eq(schema.recipeIngredientFoods.recipeIngredientId, lineId), isFirstLineFood()))
    ).resolves.toEqual([{ aliasId: butter.aliasId }]);
  });

  it("reads the next food once the first is deleted, and none once every food is gone", async () => {
    await foods(butter, oil);

    await db.delete(schema.ingredients).where(eq(schema.ingredients.id, butter.id));
    expect(await line()).toMatchObject({ ingredientName: "boter of olie", ingredientId: oil.id });

    await db.delete(schema.ingredients).where(eq(schema.ingredients.id, oil.id));
    expect(await line()).toMatchObject({ ingredientName: "boter of olie", ingredientId: null });
  });
});
