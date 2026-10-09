// @vitest-environment node
/**
 * The Pantry through Ingredient Aliases, against a real database: what the
 * household typed is resolved like any recipe line, and "in the pantry" is a
 * question about the Ingredient, not about the spelling.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createRecipeWithRefs, getRecipeFull } from "@norish/db";
import { listPantryIngredientsByUserIds } from "@norish/db/repositories/pantry";
import { addPickedToPantry, addToPantry } from "@norish/shared-server/ingredients/pantry";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";

import { createTestUser } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

describe("the Pantry through aliases", () => {
  const testBase = new RepositoryTestBase("test_pantry_aliases");

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

  async function recipeLines(...texts: string[]) {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(
      recipeId,
      userId,
      await withResolvedIngredients(
        {
          name: "Soup",
          systemUsed: "metric",
          recipeIngredients: texts.map((ingredientName, order) => ({
            ingredientId: null,
            ingredientName,
            amount: null,
            unit: null,
            order,
          })),
        },
        { userId }
      )
    );

    return (await getRecipeFull(recipeId))!.recipeIngredients;
  }

  async function pantry() {
    return listPantryIngredientsByUserIds([userId]);
  }

  it("covers a recipe line that names the same Ingredient with its preparation", async () => {
    await addToPantry(crypto.randomUUID(), { userId, userIds: [userId], name: "onions" });

    const [line] = await recipeLines("onions, diced");

    expect(pantryIngredientFor(await pantry(), line!)).toMatchObject({ name: "onions" });
  });

  it("never covers a different food that merely shares a word", async () => {
    await addToPantry(crypto.randomUUID(), { userId, userIds: [userId], name: "salt" });

    const [line] = await recipeLines("salted butter");

    expect(pantryIngredientFor(await pantry(), line!)).toBeNull();
  });

  it("refuses a second spelling of an Ingredient the household already has", async () => {
    const housemate = await createTestUser();
    const userIds = [userId, housemate.id];
    const first = await addToPantry(crypto.randomUUID(), { userId, userIds, name: "Onions" });
    const second = await addToPantry(crypto.randomUUID(), {
      userId: housemate.id,
      userIds,
      name: "onions (red)",
    });

    expect(first.created).toBe(true);
    expect(second).toEqual({ item: first.item, created: false });
    expect(await listPantryIngredientsByUserIds(userIds)).toHaveLength(1);
  });

  it("keeps a picked food as picked, once per household", async () => {
    const [line] = await recipeLines("onions, diced");
    const first = await addPickedToPantry(crypto.randomUUID(), {
      userId,
      userIds: [userId],
      ingredientId: line!.ingredientId!,
    });
    const again = await addPickedToPantry(crypto.randomUUID(), {
      userId,
      userIds: [userId],
      ingredientId: line!.ingredientId!,
    });

    expect(first).toMatchObject({ item: { ingredientId: line!.ingredientId }, created: true });
    expect(again).toEqual({ item: first!.item, created: false });
    await expect(
      addPickedToPantry(crypto.randomUUID(), {
        userId,
        userIds: [userId],
        ingredientId: crypto.randomUUID(),
      })
    ).resolves.toBeNull();
  });
});
