// @vitest-environment node
/** Deleting a Store along with the groceries the screen showed in it. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createGroceries } from "@norish/db/repositories/groceries";
import { createStore, deleteStore, getStoreById } from "@norish/db/repositories/stores";

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
    const store = await createStore(crypto.randomUUID(), { userId, name: "Markt" });
    const groceryId = crypto.randomUUID();

    await createGroceries(
      [
        {
          id: groceryId,
          groceries: {
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
      [userId]
    );

    const result = await deleteStore(store.id, store.version, true, [
      { id: groceryId, version: 1 },
    ]);

    expect(result).toEqual({ deletedGroceryIds: [groceryId], storeDeleted: true, stale: false });
    expect(await getStoreById(store.id)).toBeNull();
  });
});
