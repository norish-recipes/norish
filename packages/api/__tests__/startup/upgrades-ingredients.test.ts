// @vitest-environment node
/**
 * Rows from before 0.25, which name no food, and the links migration 0075 parked, against a real
 * database: each lands on the catalogue's food as an import with AI off would read it.
 */
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { upgradeIngredients } from "@norish/api/startup/upgrades/before-0-25-ingredients";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { deleteAccount } from "@norish/db/repositories/households";
import {
  applyIngredientSeed,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
import {
  createStore,
  findBestIngredientStorePreference,
  getIngredientStorePreference,
} from "@norish/db/repositories/stores";
import {
  aisleLinks,
  aisles,
  ingredientAliases,
  ingredients,
  parkedNameKeyedLinks,
  recipeIngredientFoods,
  serverConfig,
  storeProductLinks,
} from "@norish/db/schema";
import { forgetSpellingRules } from "@norish/shared-server/ingredients/resolver";
import { updateIngredientSeedState } from "@norish/shared-server/ingredients/seed/catalogue-seed";

import {
  addTestGrocery,
  addTestPantryIngredient,
  addTestRecurringGrocery,
  createTestRecipe,
  createTestUser,
  getTestDb,
  insertTestRecipeLine,
  joinTestHousehold,
  testGroceryFoods,
  testHouseholdOf,
  testPantrySpellings,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { seedEntry } from "../../../shared-server/__tests__/helpers/seed-entries";

describe("the upgrade of ingredients from before 0.25", () => {
  const testBase = new RepositoryTestBase("test_upgrade_ingredients");

  let userId: string;
  let seeded: Map<string, string>;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
    forgetSpellingRules();
    await getTestDb()
      .delete(serverConfig)
      .where(eq(serverConfig.key, ServerConfigKeys.INGREDIENT_SEED_STATE));
    await applyIngredientSeed([
      seedEntry("en:garlic", "garlic", "knoflook"),
      seedEntry("en:salt", "salt", "zout"),
      seedEntry("en:pepper", "pepper", "peper"),
      seedEntry("en:butter", "butter", "boter"),
    ]);
    seeded = await listSeededIngredientIds();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** An `ingredients` row as releases before 0.25 wrote it: a name, no spelling. */
  async function oldIngredient(name: string) {
    const [row] = await getTestDb().insert(ingredients).values({ name }).returning();

    return row!.id;
  }

  async function lineSpellings(lineId: string) {
    const rows = await getTestDb()
      .select({ text: ingredientAliases.text })
      .from(recipeIngredientFoods)
      .innerJoin(
        ingredientAliases,
        eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId)
      )
      .where(eq(recipeIngredientFoods.recipeIngredientId, lineId))
      .orderBy(asc(recipeIngredientFoods.position));

    return rows.map((row) => row.text);
  }

  async function park(kind: "aisle" | "product" | "preference", link: Record<string, unknown>) {
    const id = randomUUID();
    const stamp = new Date().toISOString();

    await getTestDb()
      .insert(parkedNameKeyedLinks)
      .values({
        id,
        kind,
        link: { created_at: stamp, updated_at: stamp, ...link } as never,
      });

    return id;
  }

  it("reads recipe lines, groceries and the pantry as an import does, a heading naming nothing", async () => {
    const recipe = await createTestRecipe(userId);
    const line = await insertTestRecipeLine({
      recipeId: recipe.id,
      name: "knoflook",
      amount: "2",
      order: "0",
    });
    const heading = await insertTestRecipeLine({ recipeId: recipe.id, name: "# Saus", order: "1" });
    const grocery = await addTestGrocery(userId, { name: "zout" });
    const { recurringGrocery: recurring } = await addTestRecurringGrocery(userId, {
      name: "boter",
      nextPlannedFor: "2026-11-01",
      alone: true,
    });
    const pantry = await addTestPantryIngredient(userId, {
      ingredientId: await oldIngredient("Peper"),
    });

    await upgradeIngredients();

    expect(await lineSpellings(line!.id)).toEqual(["knoflook"]);
    expect(await lineSpellings(heading!.id)).toEqual([]);

    const groceryNow = (await testGroceryFoods(userId)).find((row) => row.id === grocery.id);
    const recurringNow = (await testGroceryFoods(userId, "recurring")).find(
      (row) => row.id === recurring.id
    );
    const pantryNow = (await testPantrySpellings(userId)).find((row) => row.id === pantry.id);

    expect(groceryNow!.ingredientId).toBe(seeded.get("en:salt"));
    expect(recurringNow!.ingredientId).toBe(seeded.get("en:butter"));
    expect(pantryNow!.ingredientId).toBe(seeded.get("en:pepper"));
    expect(pantryNow!.ingredientAliasId).not.toBeNull();
  });

  it("leaves a line alone that lost its food to a delete after 0.26's cleanup", async () => {
    const recipe = await createTestRecipe(userId);
    const line = await insertTestRecipeLine({ recipeId: recipe.id, name: "knoflook", order: "0" });

    await updateIngredientSeedState({ cleanupVersion: 1 });
    await upgradeIngredients();

    expect(await lineSpellings(line!.id)).toEqual([]);
  });

  it("drops a pantry row naming a food its household already holds", async () => {
    const kept = await addTestPantryIngredient(userId, { ingredientId: seeded.get("en:salt")! });

    await addTestPantryIngredient(userId, { ingredientId: await oldIngredient("Zout") });
    await upgradeIngredients();

    expect((await testPantrySpellings(userId)).map((row) => row.id)).toEqual([kept.id]);
  });

  it("keys parked links by their grocery's food, else their name's, and drops what cannot stay", async () => {
    const db = getTestDb();
    const store = await createStore(randomUUID(), {
      householdId: testHouseholdOf(userId),
      userId,
      name: "Shop",
    });
    const [aisle] = await db
      .insert(aisles)
      .values({ storeId: store.id, name: "Spices" })
      .returning();
    const salt = seeded.get("en:salt")!;

    const [zout] = await db
      .select({ id: ingredientAliases.id })
      .from(ingredientAliases)
      .where(eq(ingredientAliases.text, "zout"));

    // A grocery a member pointed at salt in 0.25: its parked links follow it.
    await addTestGrocery(userId, {
      name: "Fleur de sel",
      ingredientAliasId: zout!.id,
      ingredientId: salt,
    });
    await db
      .insert(aisleLinks)
      .values({ storeId: store.id, ingredientId: seeded.get("en:pepper")!, aisleId: aisle!.id });

    const byGrocery = await park("aisle", {
      normalized_name: "fleur de sel",
      store_id: store.id,
      aisle_id: aisle!.id,
    });
    const byName = await park("preference", {
      normalized_name: "eggs",
      store_id: store.id,
      user_id: userId,
    });
    const taken = await park("aisle", {
      normalized_name: "peper",
      store_id: store.id,
      aisle_id: aisle!.id,
    });
    const storeGone = await park("product", { normalized_name: "zout", store_id: randomUUID() });

    expect((await upgradeIngredients()).links).toBe(2);

    const [aisleLink] = await db.select().from(aisleLinks).where(eq(aisleLinks.id, byGrocery));
    const preference = await findBestIngredientStorePreference(testHouseholdOf(userId), {
      id: randomUUID(),
      name: "eggs",
    });

    expect(aisleLink!.ingredientId).toBe(salt);
    expect(preference?.preference.id).toBe(byName);
    expect(await db.select().from(aisleLinks).where(eq(aisleLinks.id, taken))).toEqual([]);
    expect(
      await db.select().from(storeProductLinks).where(eq(storeProductLinks.id, storeGone))
    ).toEqual([]);
    expect(await db.select().from(parkedNameKeyedLinks)).toEqual([]);
  });

  it("skips a parked link whose aisle or product is gone while its Store stays", async () => {
    const store = await createStore(randomUUID(), {
      householdId: testHouseholdOf(userId),
      userId,
      name: "Shop",
    });
    const aisleGone = await park("aisle", {
      normalized_name: "zout",
      store_id: store.id,
      aisle_id: randomUUID(),
    });
    const productGone = await park("product", {
      normalized_name: "peper",
      store_id: store.id,
      store_product_id: randomUUID(),
    });

    expect((await upgradeIngredients()).links).toBe(0);

    const db = getTestDb();

    expect(await db.select().from(aisleLinks).where(eq(aisleLinks.id, aisleGone))).toEqual([]);
    expect(
      await db.select().from(storeProductLinks).where(eq(storeProductLinks.id, productGone))
    ).toEqual([]);
    expect(await db.select().from(parkedNameKeyedLinks)).toEqual([]);
  });

  /** Who an Ingredient a household row minted belongs to. */
  async function mintedBy(ingredientId: string | null) {
    const [row] = await getTestDb()
      .select({ ownerId: ingredients.ownerId })
      .from(ingredients)
      .where(eq(ingredients.id, ingredientId!));

    return row?.ownerId;
  }

  it("resolves the rows of a deleted member as their household's, not as the seed's", async () => {
    const member = (await createTestUser()).id;

    await joinTestHousehold(member, userId);
    const grocery = await addTestGrocery(member, { name: "kardemom" });
    const { recurringGrocery: recurring } = await addTestRecurringGrocery(member, {
      name: "saffraan",
      alone: true,
    });
    const pantry = await addTestPantryIngredient(member, {
      ingredientId: await oldIngredient("Komijn"),
    });

    await deleteAccount(member);
    await upgradeIngredients();

    const groceryNow = (await testGroceryFoods(userId)).find((row) => row.id === grocery.id);
    const recurringNow = (await testGroceryFoods(userId, "recurring")).find(
      (row) => row.id === recurring.id
    );
    const pantryNow = (await testPantrySpellings(userId)).find((row) => row.id === pantry.id);

    expect(await mintedBy(groceryNow!.ingredientId)).toBe(userId);
    expect(await mintedBy(recurringNow!.ingredientId)).toBe(userId);
    expect(pantryNow!.ingredientAliasId).not.toBeNull();
    expect(await mintedBy(pantryNow!.ingredientId)).toBe(userId);
  });

  it("restores a deleted account's store preference to its Store's household, added by no one", async () => {
    const store = await createStore(randomUUID(), {
      householdId: testHouseholdOf(userId),
      userId,
      name: "Shop",
    });
    const salt = seeded.get("en:salt")!;

    await park("preference", {
      normalized_name: "zout",
      store_id: store.id,
      user_id: randomUUID(),
    });
    expect((await upgradeIngredients()).links).toBe(1);

    expect(await getIngredientStorePreference(testHouseholdOf(userId), salt)).toMatchObject({
      storeId: store.id,
      userId: null,
    });
  });

  it("keys a parked link by its own household's groceries, never another household's", async () => {
    const stranger = (await createTestUser()).id;
    const salt = seeded.get("en:salt")!;
    const [zout] = await getTestDb()
      .select({ id: ingredientAliases.id })
      .from(ingredientAliases)
      .where(eq(ingredientAliases.text, "zout"));
    const store = await createStore(randomUUID(), {
      householdId: testHouseholdOf(userId),
      userId,
      name: "Shop",
    });
    const [aisle] = await getTestDb()
      .insert(aisles)
      .values({ storeId: store.id, name: "Spices" })
      .returning();

    // Another household calls salt "fleur de sel"; this one never said so.
    await addTestGrocery(stranger, {
      name: "Fleur de sel",
      ingredientAliasId: zout!.id,
      ingredientId: salt,
    });
    const parked = await park("aisle", {
      normalized_name: "fleur de sel",
      store_id: store.id,
      aisle_id: aisle!.id,
    });

    await upgradeIngredients();

    const [link] = await getTestDb().select().from(aisleLinks).where(eq(aisleLinks.id, parked));

    expect(link!.ingredientId).not.toBe(salt);
    expect(await mintedBy(link!.ingredientId)).toBe(userId);
  });
});
