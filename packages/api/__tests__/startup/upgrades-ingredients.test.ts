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
import {
  applyIngredientSeed,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
import {
  aisleLinks,
  aisles,
  groceries,
  ingredientAliases,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  parkedNameKeyedLinks,
  recipeIngredientFoods,
  recurringGroceries,
  serverConfig,
  storeProductLinks,
  stores,
} from "@norish/db/schema";
import { forgetSpellingRules } from "@norish/shared-server/ingredients/resolver";
import { updateIngredientSeedState } from "@norish/shared-server/ingredients/seed/catalogue-seed";

import {
  createTestRecipe,
  getTestDb,
  insertTestRecipeLine,
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
    const db = getTestDb();
    const recipe = await createTestRecipe(userId);
    const line = await insertTestRecipeLine({
      recipeId: recipe.id,
      name: "knoflook",
      amount: "2",
      order: "0",
    });
    const heading = await insertTestRecipeLine({ recipeId: recipe.id, name: "# Saus", order: "1" });
    const [grocery] = await db.insert(groceries).values({ userId, name: "zout" }).returning();
    const [recurring] = await db
      .insert(recurringGroceries)
      .values({ userId, name: "boter", recurrenceRule: "week", nextPlannedFor: "2026-11-01" })
      .returning();
    const [pantry] = await db
      .insert(pantryIngredients)
      .values({ userId, ingredientId: await oldIngredient("Peper") })
      .returning();

    await upgradeIngredients();

    expect(await lineSpellings(line!.id)).toEqual(["knoflook"]);
    expect(await lineSpellings(heading!.id)).toEqual([]);

    const [groceryNow] = await db.select().from(groceries).where(eq(groceries.id, grocery!.id));
    const [recurringNow] = await db
      .select()
      .from(recurringGroceries)
      .where(eq(recurringGroceries.id, recurring!.id));
    const [pantryNow] = await db
      .select()
      .from(pantryIngredients)
      .where(eq(pantryIngredients.id, pantry!.id));

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

  it("drops a pantry row naming a food its member already holds", async () => {
    const db = getTestDb();

    await db.insert(pantryIngredients).values({ userId, ingredientId: seeded.get("en:salt")! });
    const [old] = await db
      .insert(pantryIngredients)
      .values({ userId, ingredientId: await oldIngredient("Zout") })
      .returning();

    await upgradeIngredients();

    expect(
      await db.select().from(pantryIngredients).where(eq(pantryIngredients.id, old!.id))
    ).toEqual([]);
  });

  it("keys parked links by their grocery's food, else their name's, and drops what cannot stay", async () => {
    const db = getTestDb();
    const [store] = await db.insert(stores).values({ userId, name: "Shop" }).returning();
    const [aisle] = await db
      .insert(aisles)
      .values({ storeId: store!.id, name: "Spices" })
      .returning();
    const salt = seeded.get("en:salt")!;

    const [zout] = await db
      .select({ id: ingredientAliases.id })
      .from(ingredientAliases)
      .where(eq(ingredientAliases.text, "zout"));

    // A grocery a member pointed at salt in 0.25: its parked links follow it.
    await db
      .insert(groceries)
      .values({ userId, name: "Fleur de sel", ingredientAliasId: zout!.id, ingredientId: salt });
    await db
      .insert(aisleLinks)
      .values({ storeId: store!.id, ingredientId: seeded.get("en:pepper")!, aisleId: aisle!.id });

    const byGrocery = await park("aisle", {
      normalized_name: "fleur de sel",
      store_id: store!.id,
      aisle_id: aisle!.id,
    });
    const byName = await park("preference", {
      normalized_name: "eggs",
      store_id: store!.id,
      user_id: userId,
    });
    const taken = await park("aisle", {
      normalized_name: "peper",
      store_id: store!.id,
      aisle_id: aisle!.id,
    });
    const storeGone = await park("product", { normalized_name: "zout", store_id: randomUUID() });

    expect((await upgradeIngredients()).links).toBe(2);

    const [aisleLink] = await db.select().from(aisleLinks).where(eq(aisleLinks.id, byGrocery));
    const [preference] = await db
      .select({ name: ingredients.name })
      .from(ingredientStorePreferences)
      .innerJoin(ingredients, eq(ingredients.id, ingredientStorePreferences.ingredientId))
      .where(eq(ingredientStorePreferences.id, byName));

    expect(aisleLink!.ingredientId).toBe(salt);
    expect(preference!.name).toBe("eggs");
    expect(await db.select().from(aisleLinks).where(eq(aisleLinks.id, taken))).toEqual([]);
    expect(
      await db.select().from(storeProductLinks).where(eq(storeProductLinks.id, storeGone))
    ).toEqual([]);
    expect(await db.select().from(parkedNameKeyedLinks)).toEqual([]);
  });
});
