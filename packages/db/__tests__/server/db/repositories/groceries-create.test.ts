// @vitest-environment node
/**
 * A create makes room at the top of its Store by shifting every active sibling down; the shift is
 * not an edit of those rows, so their versions stay. Two writes that move one list wait for each other.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { GroceryDto } from "@norish/shared/contracts/dto/groceries";
import { withTransaction } from "@norish/db/drizzle";
import {
  createGroceries,
  deleteGroceryByIds,
  findNewestGroceryNamed,
  listGroceriesByHousehold,
  lockGroceryList,
  markAllDoneInStore,
  reorderGroceriesInStore,
  updateGroceries,
} from "@norish/db/repositories/groceries";
import { createStore } from "@norish/db/repositories/stores";
import { groceries } from "@norish/db/schema";

import {
  createTestUser,
  getTestDb,
  householdIdOf,
  testHouseholdOf,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("what a create shifts", () => {
  const testBase = new RepositoryTestBase("test_groceries_create");

  let userId: string;
  let householdId: string;
  let storeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
    householdId = await householdIdOf(userId);
    storeId = (
      await createStore(crypto.randomUUID(), {
        householdId: testHouseholdOf(userId),
        userId,
        name: "Markt",
      })
    ).id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const line = (name: string, overrides: Partial<typeof groceries.$inferInsert> = {}) => ({
    id: crypto.randomUUID(),
    groceries: {
      householdId: testHouseholdOf(userId),
      userId,
      name,
      unit: null,
      amount: null,
      isDone: false,
      recipeIngredientId: null,
      recurringGroceryId: null,
      storeId,
      ...overrides,
    },
  });

  it("hands back every active sibling in the Store, shifted down at the version it had", async () => {
    const first = await createGroceries([line("appel")], householdId);
    const second = await createGroceries([line("peer")], householdId);

    expect(first.shifted).toEqual([]);
    expect(second.shifted).toHaveLength(1);
    expect(second.shifted[0]).toMatchObject({ id: first.created[0]!.id, sortOrder: 1, version: 1 });

    const [stored] = await getTestDb()
      .select()
      .from(groceries)
      .where(eq(groceries.id, first.created[0]!.id));

    expect(stored).toMatchObject({ sortOrder: 1, version: 1 });
  });

  // The writes an offline client queues, each at the version its own earlier writes left the row.
  const rename = (id: string, version: number) =>
    updateGroceries([{ id, version, name: "havermelk" }], householdId);
  const tick = (id: string, version: number) =>
    updateGroceries([{ id, version, isDone: true }], householdId);

  it("keeps an edit queued after the user's own add, at the version read before it", async () => {
    const [melk] = (await createGroceries([line("melk")], householdId)).created;

    await createGroceries([line("brood")], householdId);

    await expect(rename(melk!.id, 1)).resolves.toMatchObject([{ name: "havermelk", version: 2 }]);
  });

  it("keeps the edit after ticking another line and adding one", async () => {
    const [melk, eieren] = (await createGroceries([line("melk"), line("eieren")], householdId))
      .created;

    await tick(eieren!.id, 1);
    await createGroceries([line("brood")], householdId);

    await expect(rename(melk!.id, 1)).resolves.toMatchObject([{ name: "havermelk" }]);
  });

  it("still refuses an edit after another member changed the line", async () => {
    const [melk] = (await createGroceries([line("melk")], householdId)).created;

    await updateGroceries([{ id: melk!.id, version: 1, amount: 2 }], householdId);

    await expect(rename(melk!.id, 1)).resolves.toEqual([]);
  });

  it("leaves a done sibling, and a sibling in another Store, alone", async () => {
    const other = await createStore(crypto.randomUUID(), {
      householdId: testHouseholdOf(userId),
      userId,
      name: "Bakker",
    });
    const done = await createGroceries([line("klaar", { isDone: true })], householdId);
    const elsewhere = await createGroceries([line("brood", { storeId: other.id })], householdId);

    const made = await createGroceries([line("peer")], householdId);

    expect(made.shifted).toEqual([]);
    await expect(
      getTestDb().select().from(groceries).where(eq(groceries.id, done.created[0]!.id))
    ).resolves.toMatchObject([{ version: 1 }]);
    await expect(
      getTestDb().select().from(groceries).where(eq(groceries.id, elsewhere.created[0]!.id))
    ).resolves.toMatchObject([{ version: 1 }]);
  });

  it("is undone with the caller's transaction, a merge and all", async () => {
    const [appel] = (await createGroceries([line("appel")], householdId)).created;

    await expect(
      withTransaction(async (tx) => {
        await updateGroceries([{ id: appel!.id, amount: 2 }], householdId, tx);
        await createGroceries([line("peer")], householdId, tx);
        throw new Error("a later write failed");
      })
    ).rejects.toThrow("a later write failed");

    await expect(
      getTestDb().select({ name: groceries.name, version: groceries.version }).from(groceries)
    ).resolves.toEqual([{ name: "appel", version: 1 }]);
  });

  // Each writer, unlocked, would hold "appel" while it waits for "kiwi", which the edit holds.
  const writers: Array<[string, (appel: GroceryDto, kiwi: GroceryDto) => Promise<unknown>]> = [
    ["a create", () => createGroceries([line("druif")], householdId)],
    [
      "an update of several",
      (appel, kiwi) =>
        updateGroceries(
          [
            { id: appel.id, isDone: true },
            { id: kiwi.id, isDone: true },
          ],
          householdId
        ),
    ],
    [
      "a reorder",
      (appel, kiwi) =>
        reorderGroceriesInStore(
          [
            { id: appel.id, version: appel.version, sortOrder: 5 },
            { id: kiwi.id, version: kiwi.version, sortOrder: 6 },
          ],
          householdId
        ),
    ],
    [
      "a delete of several",
      (appel, kiwi) =>
        deleteGroceryByIds(
          [
            { id: appel.id, version: appel.version },
            { id: kiwi.id, version: kiwi.version },
          ],
          householdId
        ),
    ],
    ["marking a Store done", () => markAllDoneInStore(householdId, storeId)],
  ];

  it.each(writers)(
    "makes %s wait for a write holding the list, rather than deadlock on its rows",
    async (_, write) => {
      const [appel, , kiwi] = (
        await createGroceries([line("appel"), line("peer"), line("kiwi")], householdId)
      ).created;
      let edited!: () => void;
      let release!: () => void;
      const editing = new Promise<void>((resolve) => (edited = resolve));
      const held = new Promise<void>((resolve) => (release = resolve));

      // Two connections idle first, so the writer below waits on a lock, not on a connection.
      await Promise.all([
        listGroceriesByHousehold(householdId),
        listGroceriesByHousehold(householdId),
      ]);

      // A rename that adds another food: it locks its row, then moves the list.
      const edit = withTransaction(async (tx) => {
        await lockGroceryList(tx, householdId);
        await updateGroceries([{ id: kiwi!.id, name: "kiwi's" }], householdId, tx);
        edited();
        await held;

        return await createGroceries([line("mango")], householdId, tx);
      });

      await editing;

      const other = write(appel!, kiwi!);

      await vi.waitFor(async () => {
        const [waiting] = await getTestDb()
          .execute<{ count: number }>(
            sql`select count(*)::int as count from pg_stat_activity
              where datname = current_database() and wait_event_type = 'Lock'`
          )
          .then((result) => result.rows);

        expect(waiting?.count).toBe(1);
      });
      release();

      await expect(Promise.all([edit, other])).resolves.toHaveLength(2);
    }
  );
});

describe("findNewestGroceryNamed", () => {
  const testBase = new RepositoryTestBase("test_groceries_newest");
  let userId: string;
  let householdId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    userId = (await testBase.beforeEachTest())[0].id;
    householdId = await householdIdOf(userId);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const add = async (name: string, isDone: boolean, adder = userId) => {
    const id = crypto.randomUUID();

    await createGroceries(
      [
        {
          id,
          groceries: {
            householdId: testHouseholdOf(adder),
            userId: adder,
            name,
            unit: null,
            amount: null,
            isDone,
            recipeIngredientId: null,
            recurringGroceryId: null,
          },
        },
      ],
      testHouseholdOf(adder)
    );

    return id;
  };

  it("answers the household's grocery last added under the name, ticked or not", async () => {
    await add("melk", false);
    const newest = await add("melk", true);

    await add("brood", false);
    await add("melk", false, (await createTestUser()).id);

    expect((await findNewestGroceryNamed(householdId, "melk"))?.id).toBe(newest);
    expect(await findNewestGroceryNamed(householdId, "kaas")).toBeNull();
  });
});

describe("the order a list comes back in", () => {
  const testBase = new RepositoryTestBase("test_groceries_list_order");
  let userId: string;
  let householdId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    userId = (await testBase.beforeEachTest())[0].id;
    householdId = await householdIdOf(userId);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const uuid = (last: number) => `00000000-0000-4000-8000-${String(last).padStart(12, "0")}`;
  const add = (id: string, name: string, storeId: string | null, isDone = false) =>
    createGroceries(
      [
        {
          id,
          groceries: {
            householdId: testHouseholdOf(userId),
            userId,
            name,
            unit: null,
            amount: null,
            isDone,
            recipeIngredientId: null,
            recurringGroceryId: null,
            storeId,
          },
        },
      ],
      householdId
    );

  it("breaks a sortOrder tie by Store, no Store first, then by id", async () => {
    const [first, second] = [uuid(1), uuid(2)];

    await createStore(second, { householdId: testHouseholdOf(userId), userId, name: "Bakker" });
    await createStore(first, { householdId: testHouseholdOf(userId), userId, name: "Markt" });
    // Every one lands at sortOrder 0, added against the expected order.
    await add(uuid(14), "brood", second);
    await add(uuid(13), "kaas", first, true);
    await add(uuid(12), "appel", first);
    await add(uuid(11), "melk", null);

    for (const listed of [await listGroceriesByHousehold(householdId)]) {
      expect(listed.map(({ name, sortOrder }) => [name, sortOrder])).toEqual([
        ["melk", 0],
        ["appel", 0],
        ["kaas", 0],
        ["brood", 0],
      ]);
    }
  });
});
