// @vitest-environment node
/** Deleting a Store along with the groceries the screen showed in it. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createGroceries } from "@norish/db/repositories/groceries";
import { createStore, deleteStore, getStoreById } from "@norish/db/repositories/stores";

import { householdIdOf, testHouseholdOf } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("deleteStore with a grocery snapshot", () => {
  const testBase = new RepositoryTestBase("test_stores_delete");
  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    userId = (await testBase.beforeEachTest())[0].id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("deletes the Store once the snapshot has emptied it", async () => {
    const store = await createStore(crypto.randomUUID(), {
      householdId: testHouseholdOf(userId),
      userId,
      name: "Markt",
    });
    const groceryId = crypto.randomUUID();

    await createGroceries(
      [
        {
          id: groceryId,
          groceries: {
            householdId: testHouseholdOf(userId),
            userId,
            name: "melk",
            unit: null,
            amount: null,
            isDone: false,
            recipeIngredientId: null,
            recurringGroceryId: null,
            storeId: store.id,
          },
        },
      ],
      await householdIdOf(userId)
    );

    const result = await deleteStore(testHouseholdOf(userId), store.id, store.version, true, [
      { id: groceryId, version: 1 },
    ]);

    expect(result).toEqual({
      deletedGroceryIds: [groceryId],
      movedGroceries: [],
      storeDeleted: true,
      stale: false,
    });
    expect(await getStoreById(store.id, testHouseholdOf(userId))).toBeNull();
  });

  it("returns the lines it moved to Unsorted, at their new version", async () => {
    const store = await createStore(crypto.randomUUID(), {
      householdId: testHouseholdOf(userId),
      userId,
      name: "Markt",
    });
    const groceryId = crypto.randomUUID();

    await createGroceries(
      [
        {
          id: groceryId,
          groceries: {
            householdId: testHouseholdOf(userId),
            userId,
            name: "melk",
            unit: null,
            amount: null,
            isDone: false,
            recipeIngredientId: null,
            recurringGroceryId: null,
            storeId: store.id,
          },
        },
      ],
      await householdIdOf(userId)
    );

    const result = await deleteStore(testHouseholdOf(userId), store.id, store.version, false, [
      { id: groceryId, version: 1 },
    ]);

    expect(result).toMatchObject({ storeDeleted: true, stale: false, deletedGroceryIds: [] });
    expect(result.movedGroceries).toEqual([
      expect.objectContaining({ id: groceryId, storeId: null, version: 2 }),
    ]);
  });
});
