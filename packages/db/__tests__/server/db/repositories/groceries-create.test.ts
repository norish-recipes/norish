// @vitest-environment node
/**
 * A create makes room at the top of its Store by shifting every active
 * sibling down, and a shifted row is a changed row: its version moves. The
 * repository hands those rows back so nobody goes on holding the old version.
 * Two writes that move one list wait for each other.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { GroceryDto } from "@norish/shared/contracts/dto/groceries";
import { withTransaction } from "@norish/db/drizzle";
import {
  createGroceries,
  deleteGroceryByIds,
  findNewestGroceryNamed,
  listGroceriesByUsers,
  lockGroceryList,
  markAllDoneInStore,
  reorderGroceriesInStore,
  updateGroceries,
} from "@norish/db/repositories/groceries";
import { createStore } from "@norish/db/repositories/stores";
import { groceries } from "@norish/db/schema";

import { getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("what a create shifts", () => {
  const testBase = new RepositoryTestBase("test_groceries_create");

  let userId: string;
  let storeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
    storeId = (await createStore(crypto.randomUUID(), { userId, name: "Markt" })).id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const line = (name: string, overrides: Partial<typeof groceries.$inferInsert> = {}) => ({
    id: crypto.randomUUID(),
    groceries: {
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

  it("hands back every active sibling in the Store, shifted down and at its new version", async () => {
    const first = await createGroceries([line("appel")], [userId]);
    const second = await createGroceries([line("peer")], [userId]);

    expect(first.shifted).toEqual([]);
    expect(second.shifted).toHaveLength(1);
    expect(second.shifted[0]).toMatchObject({ id: first.created[0]!.id, sortOrder: 1, version: 2 });

    const [stored] = await getTestDb()
      .select()
      .from(groceries)
      .where(eq(groceries.id, first.created[0]!.id));

    expect(stored).toMatchObject({ sortOrder: 1, version: 2 });
  });

  it("leaves a done sibling, and a sibling in another Store, alone", async () => {
    const other = await createStore(crypto.randomUUID(), { userId, name: "Bakker" });
    const done = await createGroceries([line("klaar", { isDone: true })], [userId]);
    const elsewhere = await createGroceries([line("brood", { storeId: other.id })], [userId]);

    const made = await createGroceries([line("peer")], [userId]);

    expect(made.shifted).toEqual([]);
    await expect(
      getTestDb().select().from(groceries).where(eq(groceries.id, done.created[0]!.id))
    ).resolves.toMatchObject([{ version: 1 }]);
    await expect(
      getTestDb().select().from(groceries).where(eq(groceries.id, elsewhere.created[0]!.id))
    ).resolves.toMatchObject([{ version: 1 }]);
  });

  it("is undone with the caller's transaction, a merge and all", async () => {
    const [appel] = (await createGroceries([line("appel")], [userId])).created;

    await expect(
      withTransaction(async (tx) => {
        await updateGroceries([{ id: appel!.id, amount: 2 }], [userId], tx);
        await createGroceries([line("peer")], [userId], tx);
        throw new Error("a later write failed");
      })
    ).rejects.toThrow("a later write failed");

    await expect(
      getTestDb().select({ name: groceries.name, version: groceries.version }).from(groceries)
    ).resolves.toEqual([{ name: "appel", version: 1 }]);
  });

  // Each writer, unlocked, would hold "appel" while it waits for "kiwi", which the edit holds.
  const writers: Array<[string, (appel: GroceryDto, kiwi: GroceryDto) => Promise<unknown>]> = [
    ["a create", () => createGroceries([line("druif")], [userId])],
    [
      "an update of several",
      (appel, kiwi) =>
        updateGroceries(
          [
            { id: appel.id, isDone: true },
            { id: kiwi.id, isDone: true },
          ],
          [userId]
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
          [userId]
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
          [userId]
        ),
    ],
    ["marking a Store done", () => markAllDoneInStore([userId], storeId)],
  ];

  it.each(writers)(
    "makes %s wait for a write holding the list, rather than deadlock on its rows",
    async (_, write) => {
      const [appel, , kiwi] = (
        await createGroceries([line("appel"), line("peer"), line("kiwi")], [userId])
      ).created;
      let edited!: () => void;
      let release!: () => void;
      const editing = new Promise<void>((resolve) => (edited = resolve));
      const held = new Promise<void>((resolve) => (release = resolve));

      // Two connections idle first, so the writer below waits on a lock, not on a connection.
      await Promise.all([listGroceriesByUsers([userId]), listGroceriesByUsers([userId])]);

      // A rename that adds another food: it locks its row, then moves the list.
      const edit = withTransaction(async (tx) => {
        await lockGroceryList(tx, [userId]);
        await updateGroceries([{ id: kiwi!.id, name: "kiwi's" }], [userId], tx);
        edited();
        await held;

        return await createGroceries([line("mango")], [userId], tx);
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

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    userId = (await testBase.beforeEachTest())[0].id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const add = async (name: string, isDone: boolean) => {
    const id = crypto.randomUUID();

    await createGroceries(
      [
        {
          id,
          groceries: {
            userId,
            name,
            unit: null,
            amount: null,
            isDone,
            recipeIngredientId: null,
            recurringGroceryId: null,
          },
        },
      ],
      [userId]
    );

    return id;
  };

  it("answers the grocery last added under the name, ticked or not", async () => {
    await add("melk", false);
    const newest = await add("melk", true);

    await add("brood", false);

    expect((await findNewestGroceryNamed("melk"))?.id).toBe(newest);
    expect(await findNewestGroceryNamed("kaas")).toBeNull();
  });
});
