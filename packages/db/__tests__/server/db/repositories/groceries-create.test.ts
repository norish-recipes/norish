// @vitest-environment node
/**
 * A create makes room at the top of its Store by shifting every active
 * sibling down, and a shifted row is a changed row: its version moves. The
 * repository hands those rows back so nobody goes on holding the old version.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createGroceries, createGrocery } from "@norish/db/repositories/groceries";
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

  const insert = (name: string, overrides: Partial<typeof groceries.$inferInsert> = {}) => ({
    userId,
    name,
    unit: null,
    amount: null,
    isDone: false,
    recipeIngredientId: null,
    recurringGroceryId: null,
    storeId,
    ...overrides,
  });
  const line = (name: string, overrides: Partial<typeof groceries.$inferInsert> = {}) => ({
    id: crypto.randomUUID(),
    groceries: insert(name, overrides),
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

  it("does the same for a single create, which is how a repeating grocery arrives", async () => {
    const first = await createGroceries([line("appel")], [userId]);
    const made = await createGrocery(crypto.randomUUID(), insert("melk"), [userId]);

    expect(made.created).toMatchObject({ name: "melk", sortOrder: 0 });
    expect(made.shifted).toEqual([
      expect.objectContaining({ id: first.created[0]!.id, sortOrder: 1, version: 2 }),
    ]);
  });
});
