// @vitest-environment node
/**
 * The Pantry at the database: a row that points at an Ingredient Name the way
 * a recipe line does, one folded name per member, read across the household in
 * one query, and gone with the member who typed it.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  getOrCreateIngredientByName,
  getOrCreateManyIngredients,
  listIngredientNamesMissingNormalizedName,
  setIngredientNormalizedNames,
} from "@norish/db/repositories/ingredients";
import {
  addPantryIngredient,
  deletePantryIngredient,
  findPantryIngredientInHousehold,
  getPantryIngredientOwnerId,
  listPantryIngredientsByUserIds,
} from "@norish/db/repositories/pantry";
import { ingredients, pantryIngredients, users } from "@norish/db/schema";

import { createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const OLIVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SALT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

  it("points at an Ingredient Name, minting it where Norish has none", async () => {
    const { item } = await addPantryIngredient(OLIVE, {
      userId,
      userIds: [userId],
      name: "  Olive Oil ",
    });

    expect(item).toMatchObject({
      id: OLIVE,
      userId,
      name: "Olive Oil",
      normalizedName: "olive oil",
    });
    await expect(getPantryIngredientOwnerId(OLIVE)).resolves.toBe(userId);

    // The name is the Ingredient Name's, folded there, not the row's own.
    const [row] = await getTestDb()
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, item.ingredientId));

    expect(row).toMatchObject({ name: "Olive Oil", normalizedName: "olive oil" });
  });

  it("folds a name minted before the folding existed, so the Pantry matches it", async () => {
    const db = getTestDb();
    const stale = await getOrCreateIngredientByName("Olive Oil");

    // Simulate a row written before the column existed.
    await db.update(ingredients).set({ normalizedName: null }).where(eq(ingredients.id, stale.id));

    const { item } = await addPantryIngredient(OLIVE, {
      userId,
      userIds: [userId],
      name: "Olive Oil",
    });

    expect(item.normalizedName).toBe("olive oil");
    await expect(findPantryIngredientInHousehold([userId], "olive oil")).resolves.toMatchObject({
      id: OLIVE,
    });
  });

  it("takes the Ingredient Name a recipe already minted, rather than a second one", async () => {
    const known = await getOrCreateIngredientByName("Olive Oil");
    const { item } = await addPantryIngredient(OLIVE, {
      userId,
      userIds: [userId],
      name: "olive oil",
    });

    expect(item.ingredientId).toBe(known.id);
    await expect(
      getTestDb().select().from(ingredients).where(eq(ingredients.normalizedName, "olive oil"))
    ).resolves.toHaveLength(1);
  });

  it("holds one folded name per household, and answers with the one it holds", async () => {
    const { item: held } = await addPantryIngredient(OLIVE, {
      userId,
      userIds: [userId],
      name: "Olive Oil",
    });
    const again = await addPantryIngredient(SALT, {
      userId,
      userIds: [userId],
      name: "olive  oil!",
    });

    expect(again).toEqual({ item: held, created: false });
    await expect(listPantryIngredientsByUserIds([userId])).resolves.toHaveLength(1);
  });

  it("answers a housemate with the item the household already has", async () => {
    const housemate = await createTestUser();

    await addPantryIngredient(OLIVE, { userId, userIds: [userId], name: "Olive Oil" });

    const { item, created } = await addPantryIngredient(SALT, {
      userId: housemate.id,
      userIds: [userId, housemate.id],
      name: "olive oil",
    });

    expect(created).toBe(false);
    expect(item.id).toBe(OLIVE);
  });

  it("refuses a name that folds to nothing", async () => {
    await expect(
      addPantryIngredient(OLIVE, { userId, userIds: [userId], name: "!?" })
    ).rejects.toThrow();
  });

  it("reads the whole household's Pantry in one query, by name", async () => {
    const housemate = await createTestUser();

    await addPantryIngredient(SALT, { userId, userIds: [userId], name: "Salt" });
    await addPantryIngredient(OLIVE, {
      userId: housemate.id,
      userIds: [housemate.id],
      name: "olive oil",
    });

    const items = await listPantryIngredientsByUserIds([userId, housemate.id]);

    expect(items.map((item) => item.name)).toEqual(["olive oil", "Salt"]);
    await expect(listPantryIngredientsByUserIds([userId])).resolves.toHaveLength(1);
    await expect(listPantryIngredientsByUserIds([])).resolves.toEqual([]);
  });

  it("finds a housemate's item by folded name, and nothing outside the household", async () => {
    const housemate = await createTestUser();
    const stranger = await createTestUser();

    await addPantryIngredient(OLIVE, {
      userId: housemate.id,
      userIds: [housemate.id],
      name: "Olive Oil",
    });

    await expect(
      findPantryIngredientInHousehold([userId, housemate.id], "olive oil")
    ).resolves.toMatchObject({ id: OLIVE });
    await expect(
      findPantryIngredientInHousehold([userId, stranger.id], "olive oil")
    ).resolves.toBeNull();
    await expect(findPantryIngredientInHousehold([userId, housemate.id], "")).resolves.toBeNull();
  });

  it("removes an item, and says so only the first time", async () => {
    await addPantryIngredient(OLIVE, { userId, userIds: [userId], name: "Olive Oil" });

    await expect(deletePantryIngredient(OLIVE)).resolves.toBe(true);
    await expect(deletePantryIngredient(OLIVE)).resolves.toBe(false);
    await expect(getPantryIngredientOwnerId(OLIVE)).resolves.toBeNull();
    await expect(listPantryIngredientsByUserIds([userId])).resolves.toEqual([]);
  });

  it("goes with the Ingredient Name it points at", async () => {
    const db = getTestDb();
    const { item } = await addPantryIngredient(OLIVE, {
      userId,
      userIds: [userId],
      name: "Olive Oil",
    });

    await db.delete(ingredients).where(eq(ingredients.id, item.ingredientId));

    await expect(listPantryIngredientsByUserIds([userId])).resolves.toEqual([]);
  });

  it("goes with the member who typed it", async () => {
    const db = getTestDb();

    await addPantryIngredient(OLIVE, { userId, userIds: [userId], name: "Olive Oil" });
    await db.delete(users).where(eq(users.id, userId));

    await expect(
      db.select().from(pantryIngredients).where(eq(pantryIngredients.id, OLIVE))
    ).resolves.toEqual([]);
  });

  /**
   * Names minted before the folding existed carry no fold, so the Pantry cannot
   * match them. The startup backfill works through them; these are the two
   * queries it is made of.
   */
  describe("the normalized-name backfill", () => {
    it("folds the names written before the folding existed, and the Pantry then matches them", async () => {
      const db = getTestDb();
      const [creme] = await getOrCreateManyIngredients(["Crème Fraîche!", "yoghurt"]);

      // Simulate rows written before the column existed.
      await db.update(ingredients).set({ normalizedName: null });
      await db
        .insert(pantryIngredients)
        .values({ id: OLIVE, userId, ingredientId: creme!.id })
        .returning({ id: pantryIngredients.id });

      // Unfolded, the name is in the Pantry but answers to nothing.
      await expect(findPantryIngredientInHousehold([userId], "creme fraiche")).resolves.toBeNull();

      const pending = await listIngredientNamesMissingNormalizedName(10);

      expect(pending.map((row) => row.name).sort()).toEqual(["Crème Fraîche!", "yoghurt"]);

      await setIngredientNormalizedNames(
        pending.map((row) => ({
          id: row.id,
          normalizedName: row.name === "yoghurt" ? "yoghurt" : "creme fraiche",
        }))
      );

      expect(await listIngredientNamesMissingNormalizedName(10)).toEqual([]);
      await expect(
        findPantryIngredientInHousehold([userId], "creme fraiche")
      ).resolves.toMatchObject({
        id: OLIVE,
      });
    });

    it("leaves a fold that is already there alone", async () => {
      const known = await getOrCreateIngredientByName("Olive Oil");

      await setIngredientNormalizedNames([{ id: known.id, normalizedName: "wrong" }]);

      const [row] = await getTestDb()
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, known.id));

      expect(row?.normalizedName).toBe("olive oil");
    });
  });
});
