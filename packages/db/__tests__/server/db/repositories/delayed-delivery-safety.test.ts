// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { setFavorite } from "@norish/db/repositories/favorites";
import { deleteDoneInStore, updateGroceries } from "@norish/db/repositories/groceries";
import { rateRecipe } from "@norish/db/repositories/ratings";
import { deleteStore } from "@norish/db/repositories/stores";
import { groceries, recipeFavorites, recipeRatings, stores } from "@norish/db/schema";

import { getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("delayed-delivery repository safety", () => {
  const testBase = new RepositoryTestBase("test_delayed_delivery_safety");

  let testUserId: string;
  let testRecipeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user, recipe] = await testBase.beforeEachTest();

    testUserId = user.id;
    testRecipeId = recipe.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("treats stale favorite removals as no-ops", async () => {
    await setFavorite(testUserId, testRecipeId, true);

    const result = await setFavorite(testUserId, testRecipeId, false, 2);
    const db = getTestDb();
    const [favorite] = await db
      .select()
      .from(recipeFavorites)
      .where(eq(recipeFavorites.recipeId, testRecipeId))
      .limit(1);

    expect(result.stale).toBe(true);
    expect(favorite?.recipeId).toBe(testRecipeId);
    expect(favorite?.version).toBe(1);
  });

  it("treats stale rating updates as no-ops", async () => {
    await rateRecipe(testUserId, testRecipeId, 3);

    const result = await rateRecipe(testUserId, testRecipeId, 5, 2);
    const db = getTestDb();
    const [rating] = await db
      .select()
      .from(recipeRatings)
      .where(eq(recipeRatings.recipeId, testRecipeId))
      .limit(1);

    expect(result).toEqual({ rating: 5, isNew: false, stale: true });
    expect(rating?.rating).toBe(3);
    expect(rating?.version).toBe(1);
  });

  it("leaves grocery rows unchanged when the supplied version is stale", async () => {
    const db = getTestDb();
    const [grocery] = await db
      .insert(groceries)
      .values({
        userId: testUserId,
        name: "Milk",
        unit: "piece",
        amount: "1",
        isDone: false,
      })
      .returning();

    const result = await updateGroceries([{ id: grocery.id, version: 2, name: "Oat milk" }]);
    const [stored] = await db.select().from(groceries).where(eq(groceries.id, grocery.id)).limit(1);

    expect(result).toEqual([]);
    expect(stored?.name).toBe("Milk");
    expect(stored?.version).toBe(1);
  });

  it("deletes only the requested done-grocery snapshot", async () => {
    const db = getTestDb();
    const [store] = await db
      .insert(stores)
      .values({ userId: testUserId, name: "Pantry", color: "primary", icon: "ShoppingBagIcon" })
      .returning();
    const [snapshotted] = await db
      .insert(groceries)
      .values({ userId: testUserId, storeId: store.id, name: "Bread", isDone: true })
      .returning();
    const [laterAdded] = await db
      .insert(groceries)
      .values({ userId: testUserId, storeId: store.id, name: "Eggs", isDone: true })
      .returning();

    const deletedIds = await deleteDoneInStore([testUserId], store.id, [
      { id: snapshotted.id, version: snapshotted.version },
    ]);
    const remainingRows = await db.select().from(groceries).where(eq(groceries.storeId, store.id));

    expect(deletedIds).toEqual([snapshotted.id]);
    expect(remainingRows.map((row) => row.id)).toEqual([laterAdded.id]);
  });

  it("preserves later-added groceries when deleting a store from an older snapshot", async () => {
    const db = getTestDb();
    const [store] = await db
      .insert(stores)
      .values({ userId: testUserId, name: "Bakery", color: "primary", icon: "ShoppingBagIcon" })
      .returning();
    const [snapshotted] = await db
      .insert(groceries)
      .values({ userId: testUserId, storeId: store.id, name: "Flour", isDone: false })
      .returning();
    const [laterAdded] = await db
      .insert(groceries)
      .values({ userId: testUserId, storeId: store.id, name: "Sugar", isDone: false })
      .returning();

    const result = await deleteStore(store.id, store.version, true, [
      { id: snapshotted.id, version: snapshotted.version },
    ]);
    const [storedStore] = await db.select().from(stores).where(eq(stores.id, store.id)).limit(1);
    const remainingRows = await db.select().from(groceries).where(eq(groceries.storeId, store.id));

    expect(result).toEqual({
      deletedGroceryIds: [snapshotted.id],
      storeDeleted: false,
      stale: false,
    });
    expect(storedStore?.id).toBe(store.id);
    expect(remainingRows.map((row) => row.id)).toEqual([laterAdded.id]);
  });
});
