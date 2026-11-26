// @vitest-environment node
/**
 * Grocery names through Ingredient Aliases, against a real database: a line
 * typed by hand and a line added from a recipe are recognised the same way,
 * and each keeps its own text; a name whose words join foods is a grocery each.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createGroceries, createRecipeWithRefs, getRecipeFull } from "@norish/db";
import { withTransaction } from "@norish/db/drizzle";
import { joinHousehold, moveToHouseholdOfOne } from "@norish/db/repositories/households";
import { deleteCatalogueIngredient } from "@norish/db/repositories/ingredient-catalogue";
import { groceryParts, resolveGroceryNames } from "@norish/shared-server/ingredients/groceries";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";

import {
  addTestGrocery,
  createTestIngredient,
  createTestUser,
  householdIdOf,
  listTestIngredientIds,
  mintTestFood,
  readTestIngredient,
  readTestSpelling,
  testGroceryFoods,
  testHouseholdOf,
} from "../../../db/__tests__/helpers/db-test-helpers";
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

  async function recipeLine(text: string, ownerId = userId) {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(
      recipeId,
      ownerId,
      await withResolvedIngredients(
        {
          name: "Soup",
          systemUsed: "metric",
          recipeIngredients: [
            { ingredientId: null, ingredientName: text, amount: 1, unit: null, order: 0 },
          ],
        },
        { userId: ownerId, householdId: await householdIdOf(ownerId) }
      )
    );

    return { ...(await getRecipeFull(recipeId))!.recipeIngredients[0]!, recipeId };
  }

  it("recognises a name typed by hand as the food a recipe line names", async () => {
    const line = await recipeLine("onions, diced");
    const [typed] = await resolveGroceryNames([{ name: "Onions" }], {
      userId,
      householdId: testHouseholdOf(userId),
    });

    expect(typed?.ingredientId).toBe(line.ingredientId);
  });

  it("gives a grocery added from a recipe line that line's alias", async () => {
    const line = await recipeLine("onions, diced");
    const [fromRecipe, typed] = await resolveGroceryNames(
      [{ name: "onions, diced", recipeIngredientId: line.id }, { name: "onions, diced" }],
      { userId, householdId: testHouseholdOf(userId) }
    );

    expect(fromRecipe).toEqual(typed);
    expect(fromRecipe?.ingredientId).toBe(line.ingredientId);
  });

  it("adds a recipe line whose food was deleted with no food, rather than minting it again", async () => {
    const line = await recipeLine("deegroller");

    await withTransaction((tx) => deleteCatalogueIngredient(tx, line.ingredientId!));

    await expect(
      resolveGroceryNames([{ name: "deegroller", recipeIngredientId: line.id }], {
        userId,
        householdId: testHouseholdOf(userId),
      })
    ).resolves.toEqual([null]);
    await expect(listTestIngredientIds()).resolves.toHaveLength(0);
  });

  it("keeps a grocery's having no food while an edit leaves its text alone, and resolves a new text", async () => {
    const [food] = await resolveGroceryNames([{ name: "deegroller" }], {
      userId,
      householdId: testHouseholdOf(userId),
    });
    const grocery = await addTestGrocery(userId, {
      name: "deegroller",
      ingredientAliasId: food!.aliasId,
      ingredientId: food!.ingredientId,
    });

    await withTransaction((tx) => deleteCatalogueIngredient(tx, food!.ingredientId));

    await expect(
      resolveGroceryNames(
        [{ name: "Deegroller", groceryId: grocery.id, householdId: testHouseholdOf(userId) }],
        { userId, householdId: testHouseholdOf(userId) }
      )
    ).resolves.toEqual([null]);
    await expect(listTestIngredientIds()).resolves.toHaveLength(0);

    const [renamed] = await resolveGroceryNames(
      [{ name: "deeg", groceryId: grocery.id, householdId: testHouseholdOf(userId) }],
      { userId, householdId: testHouseholdOf(userId) }
    );

    expect(renamed).toEqual(expect.objectContaining({ aliasId: expect.any(String) }));
  });

  it("resolves the text of a recipe line renamed on its way to the list", async () => {
    const line = await recipeLine("olive oil");
    const [renamed] = await resolveGroceryNames(
      [{ name: "extra virgin olive oil", recipeIngredientId: line.id }],
      { userId, householdId: testHouseholdOf(userId) }
    );

    expect(renamed?.ingredientId).not.toBe(line.ingredientId);
  });

  it("answers a grocery replayed after being added offline exactly as it did the first time", async () => {
    const first = await resolveGroceryNames([{ name: "Uien" }, { name: "leeks, sliced" }], {
      userId,
      householdId: testHouseholdOf(userId),
    });
    const replayed = await resolveGroceryNames([{ name: "Uien" }, { name: "leeks, sliced" }], {
      userId,
      householdId: testHouseholdOf(userId),
    });

    expect(replayed).toEqual(first);
  });

  it("keeps a typed grocery that names no food without one, and mints nothing", async () => {
    await expect(
      resolveGroceryNames([{ name: ")" }, { name: "—" }, { name: "leeks" }], {
        userId,
        householdId: testHouseholdOf(userId),
      })
    ).resolves.toEqual([null, null, expect.objectContaining({ aliasId: expect.any(String) })]);
    await expect(listTestIngredientIds()).resolves.toHaveLength(1);
  });

  it("has nothing to resolve for a grocery with no name", async () => {
    await expect(
      resolveGroceryNames([{ name: null }, { name: "  " }], {
        userId,
        householdId: testHouseholdOf(userId),
      })
    ).resolves.toEqual([null, null]);
  });

  describe("a name whose words join foods", () => {
    beforeEach(async () => {
      for (const text of ["zout", "peper", "boter", "olie"])
        await mintTestFood(testHouseholdOf(userId), text);
    });

    it("stands for a grocery per food it joins, the first of alternatives, and minting nothing", async () => {
      await expect(
        groceryParts(testHouseholdOf(userId), [
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
      await expect(listTestIngredientIds()).resolves.toHaveLength(4);
    });

    it("keeps whole a grocery whose joined text an edit leaves alone", async () => {
      const [zout] = await resolveGroceryNames([{ name: "zout" }], {
        userId,
        householdId: testHouseholdOf(userId),
      });
      const groceryId = crypto.randomUUID();

      await createGroceries(
        [
          {
            id: groceryId,
            groceries: {
              householdId: testHouseholdOf(userId),
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
        testHouseholdOf(userId)
      );

      const edit = { groceryId, householdId: testHouseholdOf(userId) };

      await expect(
        groceryParts(testHouseholdOf(userId), [
          { name: "Zout en peper", ...edit },
          { name: "peper en zout", ...edit },
        ])
      ).resolves.toEqual([
        [{ name: "Zout en peper", ...edit }],
        [
          { name: "peper", ...edit },
          { name: "zout", ...edit, id: undefined },
        ],
      ]);
    });
  });

  describe("a line naming a food outside the reader's catalogue", () => {
    /** Each answer's food and spelling, with the household each belongs to (null: the seed). */
    async function homes(refs: Array<{ aliasId: string; ingredientId: string } | null>) {
      return await Promise.all(
        refs.map(async (ref) => ({
          food: (await readTestIngredient(ref!.ingredientId))!.householdId,
          spelling: (await readTestSpelling(ref!.aliasId))!.householdId,
        }))
      );
    }

    it("goes on another household's list as that household's food, or the seed's", async () => {
      await createTestIngredient({ name: "zout" });
      const reader = (await createTestUser())!.id;
      const readerHousehold = testHouseholdOf(reader);
      const theirs = await mintTestFood(readerHousehold, "ui");
      const [ui, zout, prei] = [
        await recipeLine("ui"),
        await recipeLine("zout"),
        await recipeLine("prei"),
      ];

      const resolved = await resolveGroceryNames(
        [ui, zout, prei].map((line) => ({
          name: line.ingredientName,
          recipeIngredientId: line.id,
        })),
        { userId: reader, householdId: readerHousehold }
      );

      expect(resolved[0]?.ingredientId).toBe(theirs.ingredientId);
      // A seeded food is everyone's, so the line keeps it.
      expect(resolved[1]?.ingredientId).toBe(zout.ingredientId);
      expect(resolved[2]?.ingredientId).not.toBe(prei.ingredientId);
      await createGroceries(
        [ui, zout, prei].map((line, index) => ({
          id: crypto.randomUUID(),
          groceries: {
            householdId: readerHousehold,
            userId: reader,
            name: line.ingredientName,
            unit: null,
            amount: null,
            isDone: false,
            recipeIngredientId: line.id,
            recurringGroceryId: null,
            ingredientAliasId: resolved[index]!.aliasId,
            ingredientId: resolved[index]!.ingredientId,
          },
        })),
        readerHousehold
      );
      // The rows as written, by name: prei, ui, zout.
      const written = await testGroceryFoods(reader);

      await expect(
        homes(written.map((row) => ({ aliasId: row.aliasId!, ingredientId: row.ingredientId! })))
      ).resolves.toEqual([
        { food: readerHousehold, spelling: readerHousehold },
        { food: readerHousehold, spelling: readerHousehold },
        { food: null, spelling: null },
      ]);
      await expect(homes(resolved)).resolves.toEqual([
        { food: readerHousehold, spelling: readerHousehold },
        { food: null, spelling: null },
        { food: readerHousehold, spelling: readerHousehold },
      ]);
      await expect(
        groceryParts(readerHousehold, [{ name: "ui", recipeIngredientId: ui.id }])
      ).resolves.toEqual([[{ name: "ui", recipeIngredientId: ui.id }]]);
    });

    it("names a leaver's own food: their lines moved with them", async () => {
      const leaver = (await createTestUser())!.id;

      await joinHousehold(leaver, { householdId: testHouseholdOf(userId) });
      const line = await recipeLine("kapucijners", leaver);

      await moveToHouseholdOfOne(testHouseholdOf(userId), leaver);
      const newHousehold = await householdIdOf(leaver);
      const [resolved] = await resolveGroceryNames(
        [{ name: line.ingredientName, recipeIngredientId: line.id }],
        { userId: leaver, householdId: newHousehold }
      );
      const moved = (await getRecipeFull(line.recipeId))!.recipeIngredients[0]!;

      expect(moved.ingredientId).not.toBe(line.ingredientId);
      expect(resolved?.ingredientId).toBe(moved.ingredientId);
      await expect(homes([resolved!])).resolves.toEqual([
        { food: newHousehold, spelling: newHousehold },
      ]);
    });
  });
});
