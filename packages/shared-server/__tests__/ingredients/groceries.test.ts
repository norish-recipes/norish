// @vitest-environment node
/**
 * Grocery names through Ingredient Aliases, against a real database: a line
 * typed by hand and a line added from a recipe are recognised the same way,
 * and each keeps its own text; a name whose words join foods is a grocery each.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createGroceries, createRecipeWithRefs, getRecipeFull } from "@norish/db";
import { withTransaction } from "@norish/db/drizzle";
import { deleteCatalogueIngredient } from "@norish/db/repositories/ingredient-catalogue";
import { groceries, ingredients } from "@norish/db/schema";
import { groceryParts, resolveGroceryNames } from "@norish/shared-server/ingredients/groceries";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";

import { getTestDb, mintTestFood } from "../../../db/__tests__/helpers/db-test-helpers";
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

  it("adds a recipe line whose food was deleted with no food, rather than minting it again", async () => {
    const line = await recipeLine("deegroller");

    await withTransaction((tx) => deleteCatalogueIngredient(tx, line.ingredientId!));

    await expect(
      resolveGroceryNames([{ name: "deegroller", recipeIngredientId: line.id }], { userId })
    ).resolves.toEqual([null]);
    await expect(getTestDb().select().from(ingredients)).resolves.toHaveLength(0);
  });

  it("keeps a grocery's having no food while an edit leaves its text alone, and resolves a new text", async () => {
    const [food] = await resolveGroceryNames([{ name: "deegroller" }], { userId });
    const [grocery] = await getTestDb()
      .insert(groceries)
      .values({
        userId,
        name: "deegroller",
        ingredientAliasId: food!.aliasId,
        ingredientId: food!.ingredientId,
      })
      .returning({ id: groceries.id });

    await withTransaction((tx) => deleteCatalogueIngredient(tx, food!.ingredientId));

    await expect(
      resolveGroceryNames([{ name: "Deegroller", groceryId: grocery!.id }], { userId })
    ).resolves.toEqual([null]);
    await expect(getTestDb().select().from(ingredients)).resolves.toHaveLength(0);

    const [renamed] = await resolveGroceryNames([{ name: "deeg", groceryId: grocery!.id }], {
      userId,
    });

    expect(renamed).toEqual(expect.objectContaining({ aliasId: expect.any(String) }));
  });

  it("resolves the text of a recipe line renamed on its way to the list", async () => {
    const line = await recipeLine("olive oil");
    const [renamed] = await resolveGroceryNames(
      [{ name: "extra virgin olive oil", recipeIngredientId: line.id }],
      { userId }
    );

    expect(renamed?.ingredientId).not.toBe(line.ingredientId);
  });

  it("answers a grocery replayed after being added offline exactly as it did the first time", async () => {
    const first = await resolveGroceryNames([{ name: "Uien" }, { name: "leeks, sliced" }], {
      userId,
    });
    const replayed = await resolveGroceryNames([{ name: "Uien" }, { name: "leeks, sliced" }], {
      userId,
    });

    expect(replayed).toEqual(first);
  });

  it("keeps a typed grocery that names no food without one, and mints nothing", async () => {
    await expect(
      resolveGroceryNames([{ name: ")" }, { name: "—" }, { name: "leeks" }], { userId })
    ).resolves.toEqual([null, null, expect.objectContaining({ aliasId: expect.any(String) })]);
    await expect(getTestDb().select().from(ingredients)).resolves.toHaveLength(1);
  });

  it("has nothing to resolve for a grocery with no name", async () => {
    await expect(
      resolveGroceryNames([{ name: null }, { name: "  " }], { userId })
    ).resolves.toEqual([null, null]);
  });

  describe("a name whose words join foods", () => {
    beforeEach(async () => {
      for (const text of ["zout", "peper", "boter", "olie"]) await mintTestFood(text);
    });

    it("stands for a grocery per food it joins, the first of alternatives, and minting nothing", async () => {
      await expect(
        groceryParts([
          { id: "a", name: "Zout en peper" },
          { id: "b", name: "boter of olie" },
          { id: "c", name: "zout en suiker" },
          { id: "d", name: ")" },
          { id: "e", name: null },
        ])
      ).resolves.toEqual([
        [
          { id: "a", name: "Zout" },
          { id: undefined, name: "peper" },
        ],
        [{ id: "b", name: "boter" }],
        [{ id: "c", name: "zout en suiker" }],
        [{ id: "d", name: ")" }],
        [{ id: "e", name: null }],
      ]);
      await expect(getTestDb().select().from(ingredients)).resolves.toHaveLength(4);
    });

    it("keeps whole a grocery whose joined text an edit leaves alone", async () => {
      const [zout] = await resolveGroceryNames([{ name: "zout" }], { userId });
      const groceryId = crypto.randomUUID();

      await createGroceries(
        [
          {
            id: groceryId,
            groceries: {
              userId,
              name: "zout en peper",
              ingredientAliasId: zout!.aliasId,
              ingredientId: zout!.ingredientId,
              unit: null,
              amount: null,
              isDone: false,
              recipeIngredientId: null,
              recurringGroceryId: null,
              storeId: null,
            },
          },
        ],
        [userId]
      );

      await expect(
        groceryParts([
          { name: "Zout en peper", groceryId: groceryId },
          { name: "peper en zout", groceryId: groceryId },
        ])
      ).resolves.toEqual([
        [{ name: "Zout en peper", groceryId: groceryId }],
        [
          { name: "peper", groceryId: groceryId },
          { name: "zout", groceryId: groceryId, id: undefined },
        ],
      ]);
    });
  });
});
