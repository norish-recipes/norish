// @vitest-environment node
/**
 * The Pantry at the database: a row that points at an Ingredient through the
 * alias the typed text resolved to, one Ingredient per household, read across
 * the household in one query, and gone with the member who typed it.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  addPantryIngredient,
  deletePantryIngredient,
  findPantryIngredientInHousehold,
  getPantryIngredientOwnerId,
  listPantryIngredientsByUserIds,
} from "@norish/db/repositories/pantry";
import { ingredients, pantryIngredients, users } from "@norish/db/schema";

import { resolveIngredients } from "../../../../../shared-server/src/ingredients/resolver";
import { createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const OLIVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SALT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Add what a member typed, resolved first as the procedure does. */
async function add(id: string, input: { userId: string; userIds: string[]; name: string }) {
  const [resolved] = await resolveIngredients([input.name], { userId: input.userId });

  return addPantryIngredient(id, {
    userId: input.userId,
    userIds: input.userIds,
    ingredientAliasId: resolved!.aliasId,
    ingredientId: resolved!.ingredientId,
  });
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
      userIds: [userId],
      name: "  Olive Oil ",
    });

    expect(item).toMatchObject({
      id: OLIVE,
      userId,
      name: "Olive Oil",
    });
    await expect(getPantryIngredientOwnerId(OLIVE)).resolves.toBe(userId);

    // The name is the Ingredient's, not the row's own.
    const [row] = await getTestDb()
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, item.ingredientId));

    expect(row).toMatchObject({ name: "Olive Oil" });
  });

  it("takes the Ingredient a recipe already has, rather than a second one", async () => {
    const [known] = await resolveIngredients(["Olive Oil"], { userId });
    const { item } = await add(OLIVE, {
      userId,
      userIds: [userId],
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
      userIds: [userId],
      name: "Olive Oil",
    });
    const again = await add(SALT, {
      userId,
      userIds: [userId],
      name: "olive  oil!",
    });

    expect(again).toEqual({ item: held, created: false });
    await expect(listPantryIngredientsByUserIds([userId])).resolves.toHaveLength(1);
  });

  it("answers a housemate with the item the household already has", async () => {
    const housemate = await createTestUser();

    await add(OLIVE, { userId, userIds: [userId], name: "Olive Oil" });

    const { item, created } = await add(SALT, {
      userId: housemate.id,
      userIds: [userId, housemate.id],
      name: "olive oil",
    });

    expect(created).toBe(false);
    expect(item.id).toBe(OLIVE);
  });

  it("gives two members adding one name at the same moment one item between them", async () => {
    const housemate = await createTestUser();
    const userIds = [userId, housemate.id];

    // Two connections open and idle first, so neither add spends the other's
    // whole transaction waiting for one. Then neither can see the other's row
    // when it looks; the lock makes the second wait for the first, and then
    // find what it wrote.
    await Promise.all([
      listPantryIngredientsByUserIds(userIds),
      listPantryIngredientsByUserIds(userIds),
    ]);
    const [mine, theirs] = await Promise.all([
      add(OLIVE, { userId, userIds, name: "Olive Oil" }),
      add(SALT, { userId: housemate.id, userIds, name: "olive oil!" }),
    ]);

    expect([mine.created, theirs.created].sort()).toEqual([false, true]);
    expect(mine.item.id).toBe(theirs.item.id);
    await expect(listPantryIngredientsByUserIds(userIds)).resolves.toHaveLength(1);
  });

  it("reads the whole household's Pantry in one query, by name", async () => {
    const housemate = await createTestUser();

    await add(SALT, { userId, userIds: [userId], name: "Salt" });
    await add(OLIVE, {
      userId: housemate.id,
      userIds: [housemate.id],
      name: "olive oil",
    });

    const items = await listPantryIngredientsByUserIds([userId, housemate.id]);

    expect(items.map((item) => item.name)).toEqual(["olive oil", "Salt"]);
    await expect(listPantryIngredientsByUserIds([userId])).resolves.toHaveLength(1);
    await expect(listPantryIngredientsByUserIds([])).resolves.toEqual([]);
  });

  it("finds a housemate's item by Ingredient, and nothing outside the household", async () => {
    const housemate = await createTestUser();
    const stranger = await createTestUser();

    const { item } = await add(OLIVE, {
      userId: housemate.id,
      userIds: [housemate.id],
      name: "Olive Oil",
    });

    await expect(
      findPantryIngredientInHousehold([userId, housemate.id], item.ingredientId)
    ).resolves.toMatchObject({ id: OLIVE });
    await expect(
      findPantryIngredientInHousehold([userId, stranger.id], item.ingredientId)
    ).resolves.toBeNull();
  });

  it("removes an item, and says so only the first time", async () => {
    await add(OLIVE, { userId, userIds: [userId], name: "Olive Oil" });

    await expect(deletePantryIngredient(OLIVE)).resolves.toBe(true);
    await expect(deletePantryIngredient(OLIVE)).resolves.toBe(false);
    await expect(getPantryIngredientOwnerId(OLIVE)).resolves.toBeNull();
    await expect(listPantryIngredientsByUserIds([userId])).resolves.toEqual([]);
  });

  it("goes with the Ingredient it points at", async () => {
    const db = getTestDb();
    const { item } = await add(OLIVE, {
      userId,
      userIds: [userId],
      name: "Olive Oil",
    });

    await db.delete(ingredients).where(eq(ingredients.id, item.ingredientId));

    await expect(listPantryIngredientsByUserIds([userId])).resolves.toEqual([]);
  });

  it("goes with the member who typed it", async () => {
    const db = getTestDb();

    await add(OLIVE, { userId, userIds: [userId], name: "Olive Oil" });
    await db.delete(users).where(eq(users.id, userId));

    await expect(
      db.select().from(pantryIngredients).where(eq(pantryIngredients.id, OLIVE))
    ).resolves.toEqual([]);
  });
});
