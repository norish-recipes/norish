// @vitest-environment node
/**
 * Stores, groceries, recurring groceries, the Pantry, plan entries, corrections and
 * store preferences belong to the household (ADR-0041): a member who leaves takes
 * none of them, and deleting an account deletes none of them.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listGroceriesByHousehold } from "@norish/db/repositories/groceries";
import { deleteAccount, moveToHouseholdOfOne } from "@norish/db/repositories/households";
import {
  findHouseholdCorrections,
  saveNutritionCorrection,
} from "@norish/db/repositories/ingredient-nutrition";
import { listPantryIngredientsByHousehold } from "@norish/db/repositories/pantry";
import {
  createPlannedItem,
  listPlannedItemsByHouseholdAndDateRange,
} from "@norish/db/repositories/planned-items";
import { listRecurringGroceriesByHousehold } from "@norish/db/repositories/recurring-groceries";
import {
  createStore,
  getIngredientStorePreference,
  listStoresByHousehold,
  upsertIngredientStorePreference,
} from "@norish/db/repositories/stores";

import {
  addTestGrocery,
  addTestPantryIngredient,
  addTestRecurringGrocery,
  createTestUser,
  householdIdOf,
  joinTestHousehold,
  mintTestFood,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const DAY = "2027-03-01";

describe("household rows", () => {
  const testBase = new RepositoryTestBase("test_household_rows");
  let admin: string;
  let member: string;
  let household: string;
  let food: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    admin = user.id;
    member = (await createTestUser()).id;
    household = await joinTestHousehold(member, admin);
    food = (await mintTestFood("melk")).ingredientId;

    // The member adds one of everything.
    const store = await createStore(crypto.randomUUID(), {
      householdId: household,
      userId: member,
      name: "Markt",
    });

    await addTestGrocery(member, { name: "melk", ingredientId: food, storeId: store.id });
    await addTestRecurringGrocery(member, { name: "brood" });
    await addTestPantryIngredient(member, { ingredientId: food });
    await createPlannedItem({
      householdId: household,
      userId: member,
      date: DAY,
      slot: "Dinner",
      itemType: "note",
      title: "Soep",
    });
    await saveNutritionCorrection(household, member, food, {
      numbersFood: null,
      kcal: 42,
      fat: 1,
      carbs: 5,
      protein: 3,
      pieceWeightFood: null,
      pieceWeight: null,
      densityFood: null,
      density: null,
    });
    await upsertIngredientStorePreference(household, member, food, store.id);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** Everything a household holds of the seven kinds, by who added it. */
  async function held(householdId: string) {
    return {
      stores: (await listStoresByHousehold(householdId)).map((row) => row.userId),
      groceries: (await listGroceriesByHousehold(householdId)).map((row) => row.name).sort(),
      recurring: (await listRecurringGroceriesByHousehold(householdId)).map((row) => row.name),
      pantry: (await listPantryIngredientsByHousehold(householdId)).map((row) => row.userId),
      plan: (await listPlannedItemsByHouseholdAndDateRange(householdId, DAY, DAY)).map(
        (row) => row.userId
      ),
      corrections: [...(await findHouseholdCorrections([food], householdId)).values()].map(
        (row) => row.userId
      ),
      preference: (await getIngredientStorePreference(householdId, food))?.userId,
    };
  }

  it("keeps everything a member added when they leave, and their new household starts empty", async () => {
    const left = await moveToHouseholdOfOne(household, member);

    expect(left.stale).toBe(false);
    expect(await held(household)).toEqual({
      stores: [member],
      groceries: ["brood", "melk"],
      recurring: ["brood"],
      pantry: [member],
      plan: [member],
      corrections: [member],
      preference: member,
    });
    expect(await held(await householdIdOf(member))).toEqual({
      stores: [],
      groceries: [],
      recurring: [],
      pantry: [],
      plan: [],
      corrections: [],
      preference: undefined,
    });
  });

  it("keeps everything a member added when their account is deleted, added by no one", async () => {
    await deleteAccount(member);

    expect(await held(household)).toEqual({
      stores: [null],
      groceries: ["brood", "melk"],
      recurring: ["brood"],
      pantry: [null],
      plan: [null],
      corrections: [null],
      preference: null,
    });
  });

  it("goes with a household whose last member deletes their account", async () => {
    await moveToHouseholdOfOne(household, member);
    // A household of one again: its last member's deletion erases it with what it holds.
    const own = await householdIdOf(member);

    await createStore(crypto.randomUUID(), { householdId: own, userId: member, name: "Eigen" });
    await deleteAccount(member);

    expect((await held(own)).stores).toEqual([]);
    expect((await held(household)).stores).toEqual([null]);
  });
});
