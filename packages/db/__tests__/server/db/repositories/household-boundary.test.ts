// @vitest-environment node
/**
 * The household boundary in the repositories (ADR-0041): household B's by-id reads and writes
 * never reach household A's rows, and no write points B's rows at A's.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  assignGroceryToStore,
  createGroceries,
  deleteGroceryByIds,
  getGroceriesByIds,
  reorderGroceriesInStore,
  updateGroceries,
} from "@norish/db/repositories/groceries";
import { ForeignHouseholdReferenceError } from "@norish/db/repositories/household-rows";
import { deletePantryIngredient } from "@norish/db/repositories/pantry";
import {
  createPlannedItem,
  deletePlannedItem,
  editPlannedItem,
  getPlannedItemById,
  getPlannedItemWithRecipeById,
  moveItem,
} from "@norish/db/repositories/planned-items";
import {
  createRecurringGroceries,
  deleteRecurringGroceryById,
  detachRecurringGrocery,
  getDueRecurringGroceries,
  getRecurringGroceryById,
  uncheckGrocery,
  updateRecurringGrocery,
  updateRecurringGroceryWithGrocery,
} from "@norish/db/repositories/recurring-groceries";
import {
  countGroceriesInStore,
  createStore,
  deleteStore,
  getStoreById,
  updateStore,
  upsertIngredientStorePreference,
} from "@norish/db/repositories/stores";
import {
  groceries,
  pantryIngredients,
  plannedItems,
  recurringGroceries,
  stores,
} from "@norish/db/schema";

import {
  addTestGrocery,
  addTestPantryIngredient,
  addTestRecurringGrocery,
  createTestUser,
  getTestDb,
  householdIdOf,
  mintTestFood,
  testHouseholdOf,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("the household boundary", () => {
  const testBase = new RepositoryTestBase("test_household_boundary");
  let a: string;
  let b: string;
  let aUser: string;
  let bUser: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    aUser = user.id;
    bUser = (await createTestUser()).id;
    a = await householdIdOf(aUser);
    b = await householdIdOf(bUser);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const row = async (
    table: typeof stores | typeof groceries | typeof recurringGroceries,
    id: string
  ) => (await getTestDb().select().from(table).where(eq(table.id, id)))[0];

  const storeOf = (householdId: string, userId: string, name: string) =>
    createStore(crypto.randomUUID(), { householdId, userId, name });

  it("reads, edits, counts and deletes none of another household's Stores", async () => {
    const store = await storeOf(a, aUser, "Markt");

    await addTestGrocery(aUser, { name: "melk", storeId: store.id });

    expect(await getStoreById(store.id, b)).toBeNull();
    expect(await countGroceriesInStore(store.id, b)).toBe(0);
    expect(await updateStore({ id: store.id, version: store.version, name: "Mine" }, b)).toBeNull();
    expect((await deleteStore(b, store.id, store.version, true)).storeDeleted).toBe(false);
    expect((await row(stores, store.id))?.name).toBe("Markt");
    expect(await countGroceriesInStore(store.id, a)).toBe(1);
  });

  it("reads, edits, moves and deletes none of another household's groceries", async () => {
    const grocery = await addTestGrocery(aUser, { name: "melk" });
    const own = await storeOf(b, bUser, "Eigen");

    expect(await getGroceriesByIds([grocery.id], b)).toEqual([]);
    expect(await updateGroceries([{ id: grocery.id, name: "kaas" }], b)).toEqual([]);
    expect(
      await reorderGroceriesInStore([{ id: grocery.id, version: grocery.version, sortOrder: 9 }], b)
    ).toEqual([]);
    expect(await assignGroceryToStore(grocery.id, own.id, b, grocery.version)).toBeNull();
    expect((await deleteGroceryByIds([grocery], b)).deletedIds).toEqual([]);
    await uncheckGrocery(grocery.id, b);

    expect(await row(groceries, grocery.id)).toMatchObject({
      name: "melk",
      sortOrder: 0,
      storeId: null,
      version: grocery.version,
    });
  });

  it("reads, edits, detaches and deletes none of another household's recurring groceries", async () => {
    const { recurringGrocery, grocery } = await addTestRecurringGrocery(aUser, { name: "brood" });

    expect(await getRecurringGroceryById(recurringGrocery.id, b)).toBeNull();
    expect(await updateRecurringGrocery({ id: recurringGrocery.id, name: "kaas" }, b)).toBeNull();
    expect(
      (
        await updateRecurringGroceryWithGrocery(
          b,
          { id: recurringGrocery.id, version: recurringGrocery.version, name: "kaas" },
          { id: grocery.id, version: grocery.version }
        )
      ).stale
    ).toBe(true);
    expect(
      (
        await detachRecurringGrocery(b, {
          recurringGroceryId: recurringGrocery.id,
          recurringVersion: recurringGrocery.version,
          grocery: { ...grocery, name: "kaas", amount: null, unit: null },
        })
      ).stale
    ).toBe(true);
    expect((await deleteRecurringGroceryById(b, recurringGrocery.id)).deletedGroceryIds).toEqual(
      []
    );

    expect((await row(recurringGroceries, recurringGrocery.id))?.name).toBe("brood");
    expect((await row(groceries, grocery.id))?.recurringGroceryId).toBe(recurringGrocery.id);
  });

  it("deletes none of another household's Pantry", async () => {
    const food = (await mintTestFood(testHouseholdOf(aUser), "melk")).ingredientId;
    const item = await addTestPantryIngredient(aUser, { ingredientId: food });

    expect(await deletePantryIngredient(item.id, b)).toBe(false);
    expect(
      await getTestDb().select().from(pantryIngredients).where(eq(pantryIngredients.id, item.id))
    ).toHaveLength(1);
  });

  it("reads, edits, moves and deletes none of another household's plan", async () => {
    const entry = await createPlannedItem({
      householdId: a,
      userId: aUser,
      date: "2027-03-01",
      slot: "Dinner",
      itemType: "note",
      title: "Soep",
    });

    expect(await getPlannedItemById(entry.id, b)).toBeNull();
    expect(await getPlannedItemWithRecipeById(entry.id, b)).toBeNull();
    expect((await editPlannedItem(b, entry.id, { title: "Mine" }, entry.version)).stale).toBe(true);
    expect((await moveItem(b, entry.id, "2027-03-02", "Lunch", 0, entry.version)).stale).toBe(true);
    expect((await deletePlannedItem(entry.id, b, entry.version)).stale).toBe(true);

    expect(
      (await getTestDb().select().from(plannedItems).where(eq(plannedItems.id, entry.id)))[0]
    ).toMatchObject({ title: "Soep", date: "2027-03-01", slot: "Dinner" });
  });

  it("points no grocery, recurring grocery or store preference at another household's rows", async () => {
    const theirs = await storeOf(a, aUser, "Markt");
    const { recurringGrocery, grocery: theirGrocery } = await addTestRecurringGrocery(aUser, {
      name: "brood",
    });
    const mine = await addTestGrocery(bUser, { name: "kaas" });
    const { recurringGrocery: myRecurring, grocery: myRecurringGrocery } =
      await addTestRecurringGrocery(bUser, { name: "boter" });
    const food = (await mintTestFood(testHouseholdOf(aUser), "melk")).ingredientId;
    const line = (fields: { storeId?: string; recurringGroceryId?: string }) => ({
      id: crypto.randomUUID(),
      groceries: {
        householdId: b,
        userId: bUser,
        name: "melk",
        unit: null,
        amount: null,
        isDone: false,
        recipeIngredientId: null,
        recurringGroceryId: null,
        ...fields,
      },
    });

    await expect(createGroceries([line({ storeId: theirs.id })], b)).rejects.toThrow(
      ForeignHouseholdReferenceError
    );
    await expect(
      createGroceries([line({ recurringGroceryId: recurringGrocery.id })], b)
    ).rejects.toThrow(ForeignHouseholdReferenceError);
    await expect(updateGroceries([{ id: mine.id, storeId: theirs.id }], b)).rejects.toThrow(
      ForeignHouseholdReferenceError
    );
    await expect(
      updateGroceries([{ id: mine.id, recurringGroceryId: recurringGrocery.id }], b)
    ).rejects.toThrow(ForeignHouseholdReferenceError);
    await expect(
      reorderGroceriesInStore(
        [{ id: mine.id, version: mine.version, sortOrder: 0, storeId: theirs.id }],
        b
      )
    ).rejects.toThrow(ForeignHouseholdReferenceError);
    await expect(assignGroceryToStore(mine.id, theirs.id, b, mine.version)).rejects.toThrow(
      ForeignHouseholdReferenceError
    );
    await expect(
      updateRecurringGroceryWithGrocery(
        b,
        { id: myRecurring.id, version: myRecurring.version },
        { id: myRecurringGrocery.id, version: myRecurringGrocery.version, storeId: theirs.id }
      )
    ).rejects.toThrow(ForeignHouseholdReferenceError);
    await expect(
      detachRecurringGrocery(b, {
        recurringGroceryId: myRecurring.id,
        recurringVersion: myRecurring.version,
        grocery: { ...myRecurringGrocery, amount: null, unit: null, storeId: theirs.id },
      })
    ).rejects.toThrow(ForeignHouseholdReferenceError);
    await expect(upsertIngredientStorePreference(b, bUser, food, theirs.id)).rejects.toThrow(
      ForeignHouseholdReferenceError
    );
    await expect(
      createRecurringGroceries(
        [
          {
            recurring: {
              id: crypto.randomUUID(),
              householdId: b,
              userId: bUser,
              name: "melk",
              amount: null,
              unit: null,
              recurrenceRule: "week",
              recurrenceInterval: 1,
              recurrenceWeekday: null,
              nextPlannedFor: "2027-01-01",
              lastCheckedDate: null,
            },
            grocery: line({ storeId: theirs.id }),
          },
        ],
        b
      )
    ).rejects.toThrow(ForeignHouseholdReferenceError);
    expect((await row(groceries, theirGrocery.id))?.householdId).toBe(a);
  });

  /** A grocery of A filed under B's Store and repeating B's recurring grocery, as a past bug left. */
  async function crossLinked() {
    const theirStore = await storeOf(b, bUser, "Eigen");
    const { recurringGrocery } = await addTestRecurringGrocery(bUser, {
      name: "brood",
      nextPlannedFor: "2020-01-01",
      alone: true,
    });
    const grocery = await addTestGrocery(aUser, { name: "brood", isDone: true });

    await getTestDb()
      .update(groceries)
      .set({ storeId: theirStore.id, recurringGroceryId: recurringGrocery.id })
      .where(eq(groceries.id, grocery.id));

    return { theirStore, recurringGrocery, grocery };
  }

  it("deletes or unchecks no grocery of another household through its Store or recurring grocery", async () => {
    const { theirStore, recurringGrocery, grocery } = await crossLinked();

    expect(await getDueRecurringGroceries()).toEqual([]);
    expect((await deleteRecurringGroceryById(b, recurringGrocery.id)).deletedGroceryIds).toEqual(
      []
    );
    expect(
      (await deleteStore(b, theirStore.id, theirStore.version, true)).deletedGroceryIds
    ).toEqual([]);
    expect(await row(groceries, grocery.id)).toMatchObject({ householdId: a, isDone: true });
  });

  it("moves no grocery of another household off a Store it deletes", async () => {
    const { theirStore, grocery } = await crossLinked();

    expect((await deleteStore(b, theirStore.id, theirStore.version, false)).movedGroceries).toEqual(
      []
    );
    expect((await row(groceries, grocery.id))?.version).toBe(grocery.version);
  });
});
