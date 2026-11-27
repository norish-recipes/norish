// @vitest-environment node
/**
 * The Pantry at the database: a row that points at an Ingredient through the
 * alias the typed text resolved to, one Ingredient per household, read by the
 * household in one query, and kept by it when the member who typed it goes.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { deleteAccount } from "@norish/db/repositories/households";
import {
  addPantryIngredients,
  deletePantryIngredient,
  findPantryIngredientInHousehold,
  listPantryIngredientsByHousehold,
  listPantrySuggestions,
  ownPantryIngredientExists,
} from "@norish/db/repositories/pantry";
import { ingredients, pantryIngredients, recipes } from "@norish/db/schema";

import {
  resolveIngredients,
  resolveLineFoods,
} from "../../../../../shared-server/src/ingredients/resolver";
import {
  createTestUser,
  getTestDb,
  insertTestRecipeLine,
  joinTestHousehold,
  testHouseholdOf,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const OLIVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SALT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Add what a member typed, resolved first as the procedure does. */
async function add(id: string, input: { userId: string; name: string }) {
  const [resolved] = await resolveIngredients([input.name], {
    userId: input.userId,
    householdId: testHouseholdOf(input.userId),
  });
  const [added] = await addPantryIngredients(
    [{ id, ingredientAliasId: resolved!.aliasId, ingredientId: resolved!.ingredientId }],
    { userId: input.userId, householdId: testHouseholdOf(input.userId) }
  );

  return added!;
}

describe("pantry ingredients", () => {
  const testBase = new RepositoryTestBase("test_pantry");

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

  it("points at an Ingredient, minting it where Norish has none", async () => {
    const { item } = await add(OLIVE, {
      userId,
      name: "  Olive Oil ",
    });

    expect(item).toMatchObject({
      id: OLIVE,
      userId,
      name: "Olive Oil",
    });
    await expect(ownPantryIngredientExists(testHouseholdOf(userId), OLIVE)).resolves.toBe(true);

    // The name is the Ingredient's, not the row's own.
    const [row] = await getTestDb()
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, item.ingredientId));

    expect(row).toMatchObject({ name: "Olive Oil" });
  });

  it("takes the Ingredient a recipe already has, rather than a second one", async () => {
    const [known] = await resolveIngredients(["Olive Oil"], {
      userId,
      householdId: testHouseholdOf(userId),
    });
    const { item } = await add(OLIVE, {
      userId,
      name: "olive oil",
    });

    expect(item.ingredientId).toBe(known!.ingredientId);
    await expect(
      getTestDb()
        .select()
        .from(ingredients)
        .where(eq(sql`lower(${ingredients.name})`, "olive oil"))
    ).resolves.toHaveLength(1);
  });

  it("holds one Ingredient per household, and answers with the one it holds", async () => {
    const { item: held } = await add(OLIVE, {
      userId,
      name: "Olive Oil",
    });
    const again = await add(SALT, {
      userId,
      name: "olive  oil!",
    });

    expect(again).toEqual({ item: held, created: false });
    await expect(listPantryIngredientsByHousehold(testHouseholdOf(userId))).resolves.toHaveLength(
      1
    );
  });

  it("answers a housemate with the item the household already has", async () => {
    const housemate = await createTestUser();

    await joinTestHousehold(housemate.id, userId);

    await add(OLIVE, { userId, name: "Olive Oil" });

    const { item, created } = await add(SALT, {
      userId: housemate.id,
      name: "olive oil",
    });

    expect(created).toBe(false);
    expect(item.id).toBe(OLIVE);
  });

  it("gives two members adding one name at the same moment one item between them", async () => {
    const housemate = await createTestUser();

    await joinTestHousehold(housemate.id, userId);

    // Two connections open and idle first, so neither add spends the other's
    // whole transaction waiting for one. Then neither can see the other's row
    // when it looks; the lock makes the second wait for the first, and then
    // find what it wrote.
    await Promise.all([
      listPantryIngredientsByHousehold(testHouseholdOf(userId)),
      listPantryIngredientsByHousehold(testHouseholdOf(userId)),
    ]);
    const [mine, theirs] = await Promise.all([
      add(OLIVE, { userId, name: "Olive Oil" }),
      add(SALT, { userId: housemate.id, name: "olive oil!" }),
    ]);

    expect([mine.created, theirs.created].sort()).toEqual([false, true]);
    expect(mine.item.id).toBe(theirs.item.id);
    await expect(listPantryIngredientsByHousehold(testHouseholdOf(userId))).resolves.toHaveLength(
      1
    );
  });

  it("puts several Ingredients in together, or none", async () => {
    const [olive] = await resolveIngredients(["olive oil"], {
      userId,
      householdId: testHouseholdOf(userId),
    });

    await expect(
      addPantryIngredients(
        [
          { id: OLIVE, ingredientAliasId: olive!.aliasId, ingredientId: olive!.ingredientId },
          { id: SALT, ingredientAliasId: null, ingredientId: crypto.randomUUID() },
        ],
        { userId, householdId: testHouseholdOf(userId) }
      )
    ).rejects.toThrow();
    await expect(listPantryIngredientsByHousehold(testHouseholdOf(userId))).resolves.toEqual([]);
  });

  it("reads the whole household's Pantry in one query, by name", async () => {
    const housemate = await createTestUser();
    const stranger = await createTestUser();

    await joinTestHousehold(housemate.id, userId);
    await add(SALT, { userId, name: "Salt" });
    await add(OLIVE, {
      userId: housemate.id,
      name: "olive oil",
    });

    const items = await listPantryIngredientsByHousehold(testHouseholdOf(userId));

    expect(items.map((item) => item.name)).toEqual(["olive oil", "Salt"]);
    await expect(listPantryIngredientsByHousehold(testHouseholdOf(stranger.id))).resolves.toEqual(
      []
    );
  });

  it("finds a housemate's item by Ingredient, and nothing outside the household", async () => {
    const housemate = await createTestUser();
    const stranger = await createTestUser();

    await joinTestHousehold(housemate.id, userId);

    const { item } = await add(OLIVE, {
      userId: housemate.id,
      name: "Olive Oil",
    });

    await expect(
      findPantryIngredientInHousehold(testHouseholdOf(userId), item.ingredientId)
    ).resolves.toMatchObject({ id: OLIVE });
    await expect(
      findPantryIngredientInHousehold(testHouseholdOf(stranger.id), item.ingredientId)
    ).resolves.toBeNull();
  });

  it("removes an item, and says so only the first time", async () => {
    await add(OLIVE, { userId, name: "Olive Oil" });

    await expect(deletePantryIngredient(OLIVE, testHouseholdOf(userId))).resolves.toBe(true);
    await expect(deletePantryIngredient(OLIVE, testHouseholdOf(userId))).resolves.toBe(false);
    await expect(ownPantryIngredientExists(testHouseholdOf(userId), OLIVE)).resolves.toBe(false);
    await expect(listPantryIngredientsByHousehold(testHouseholdOf(userId))).resolves.toEqual([]);
  });

  it("goes with the Ingredient it points at", async () => {
    const db = getTestDb();
    const { item } = await add(OLIVE, {
      userId,
      name: "Olive Oil",
    });

    await db.delete(ingredients).where(eq(ingredients.id, item.ingredientId));

    await expect(listPantryIngredientsByHousehold(testHouseholdOf(userId))).resolves.toEqual([]);
  });

  it("stays with the household when the member who typed it is deleted", async () => {
    const housemate = await createTestUser();

    await joinTestHousehold(housemate.id, userId);
    await add(OLIVE, { userId: housemate.id, name: "Olive Oil" });
    await deleteAccount(housemate.id);

    await expect(
      getTestDb()
        .select({ householdId: pantryIngredients.householdId, userId: pantryIngredients.userId })
        .from(pantryIngredients)
        .where(eq(pantryIngredients.id, OLIVE))
    ).resolves.toEqual([{ householdId: testHouseholdOf(userId), userId: null }]);
  });

  describe("From your recipes", () => {
    /** A recipe owned by a member, its lines resolved as a recipe save resolves them. */
    async function recipe(ownerId: string, lines: string[]) {
      const db = getTestDb();
      const [row] = await db
        .insert(recipes)
        .values({ userId: ownerId, name: "Soup" })
        .returning({ id: recipes.id });
      const foods = lines.filter((line) => !line.startsWith("#"));
      const resolved = await resolveLineFoods(
        foods.map((line) => line.replace(/\(id:.*\)$/, "").replace(/[[\]]/g, "")),
        { userId: ownerId, householdId: testHouseholdOf(ownerId) }
      );

      for (const [order, name] of lines.entries()) {
        const line = resolved[foods.indexOf(name)];

        await insertTestRecipeLine(
          { recipeId: row!.id, name, order: String(order), joined: line?.joined },
          line?.foods.map((food) => food.aliasId)
        );
      }
    }

    const offered = async (memberId: string) =>
      (await listPantrySuggestions(testHouseholdOf(memberId))).map(({ name, recipeCount }) => [
        name,
        recipeCount,
      ]);

    it("ranks the foods by how many of the household's recipes name them, once each", async () => {
      await recipe(userId, ["onion", "garlic", "onion, diced"]);
      await recipe(userId, ["onion", "rice"]);

      expect(await offered(userId)).toEqual([
        ["onion", 2],
        ["garlic", 1],
        ["rice", 1],
      ]);
    });

    it("counts only recipes the household's members own", async () => {
      const housemate = await createTestUser();
      const stranger = await createTestUser();

      await joinTestHousehold(housemate.id, userId);
      await recipe(userId, ["garlic"]);
      await recipe(housemate.id, ["garlic", "rice"]);
      await recipe(stranger.id, ["rice", "saffron"]);

      expect(await offered(userId)).toEqual([
        ["garlic", 2],
        ["rice", 1],
      ]);
    });

    it("counts every food a line names", async () => {
      await resolveIngredients(["zout", "peper"], { userId, householdId: testHouseholdOf(userId) });
      await recipe(userId, ["zout en peper"]);

      expect(await offered(userId)).toEqual([
        ["peper", 1],
        ["zout", 1],
      ]);
    });

    it("never counts a line that names no food", async () => {
      await recipe(userId, [
        "# For the sauce",
        "[pizza dough](id:7e300351-13a4-4bfb-8b40-7a1a5a5f8d01)",
        "basil",
      ]);

      expect(await offered(userId)).toEqual([["basil", 1]]);
    });

    it("leaves out what the Pantry covers: the same food, or a food a kept kind of it is", async () => {
      await recipe(userId, ["onion", "olive oil", "rice"]);
      await add(OLIVE, { userId, name: "olive oil" });

      const { item: red } = await add(SALT, { userId, name: "red onion" });
      const [onion] = await resolveIngredients(["onion"], {
        userId,
        householdId: testHouseholdOf(userId),
      });

      await getTestDb()
        .update(ingredients)
        .set({ parentId: onion!.ingredientId })
        .where(eq(ingredients.id, red.ingredientId));

      expect(await offered(userId)).toEqual([["rice", 1]]);
    });
  });
});
