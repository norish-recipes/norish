// @vitest-environment node
/**
 * Household rows through their routers, with the real guard and repositories: a household changes
 * its own and a housemate's rows, and another household reads and changes none of them.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@norish/shared/contracts";

import { RepositoryTestBase } from "../../db/__tests__/helpers/repository-test-base";

vi.mock("@norish/shared-server/realtime/groceries", () => import("./mocks/realtime/groceries"));
vi.mock("@norish/shared-server/realtime/stores", () => import("./mocks/realtime/stores"));
vi.mock("@norish/shared-server/realtime/pantry", () => import("./mocks/realtime/pantry"));
vi.mock("@norish/shared-server/realtime/calendar", () => import("./mocks/realtime/calendar"));

const DAY = "2027-03-01";

describe("household rows through their routers", () => {
  const testBase = new RepositoryTestBase("test_household_rows_routers");
  let helpers: typeof import("../../db/__tests__/helpers/db-test-helpers");
  let routers: {
    groceries: typeof import("../src/routers/groceries").groceriesRouter;
    stores: typeof import("../src/routers/stores").storesRouter;
    pantry: typeof import("../src/routers/pantry").pantryRouter;
    calendar: typeof import("../src/routers/calendar").calendarRouter;
  };
  let repositories: {
    stores: typeof import("@norish/db/repositories/stores");
    planned: typeof import("@norish/db/repositories/planned-items");
    households: typeof import("@norish/db/repositories/households");
  };
  let admin: User;
  let housemate: User;
  let stranger: User;

  beforeAll(async () => {
    await testBase.setup();
    helpers = await import("../../db/__tests__/helpers/db-test-helpers");
    routers = {
      groceries: (await import("../src/routers/groceries")).groceriesRouter,
      stores: (await import("../src/routers/stores")).storesRouter,
      pantry: (await import("../src/routers/pantry")).pantryRouter,
      calendar: (await import("../src/routers/calendar")).calendarRouter,
    };
    repositories = {
      stores: await import("@norish/db/repositories/stores"),
      planned: await import("@norish/db/repositories/planned-items"),
      households: await import("@norish/db/repositories/households"),
    };
  });

  beforeEach(async () => {
    const [stored] = await testBase.beforeEachTest();
    const asUser = (row: { id: string; name: string | null }) =>
      ({ ...row, isServerAdmin: false }) as User;

    admin = asUser(stored);
    housemate = asUser(await helpers.createTestUser());
    stranger = asUser(await helpers.createTestUser());
    await helpers.joinTestHousehold(housemate.id, admin.id);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** The context the HTTP path builds: the account and the household read for this request. */
  async function contextOf(user: User) {
    const household = await repositories.households.getHouseholdForUser(user.id);

    return {
      user,
      household: household && {
        id: household.id,
        name: household.name,
        users: household.users.map(({ id, name }) => ({ id, name: name ?? "" })),
      },
      connectionId: null,
      operationId: null,
    };
  }

  const as = async <R extends { createCaller: (ctx: never) => unknown }>(router: R, user: User) =>
    router.createCaller((await contextOf(user)) as never) as ReturnType<R["createCaller"]>;

  async function housemateStore() {
    return repositories.stores.createStore(crypto.randomUUID(), {
      householdId: helpers.testHouseholdOf(admin.id),
      userId: housemate.id,
      name: "Markt",
    });
  }

  it("stores: a housemate's Store is the household's, and another household's is out of reach", async () => {
    const store = await housemateStore();
    const mine = await as(routers.stores, admin);
    const theirs = await as(routers.stores, stranger);

    expect((await mine.list()).map((row) => row.id)).toEqual([store.id]);
    expect(await theirs.list()).toEqual([]);
    await expect(
      theirs.update({ id: store.id, version: store.version, name: "Mine now" })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      theirs.delete({ storeId: store.id, version: store.version, grocerySnapshot: [] })
    ).rejects.toThrow("FORBIDDEN");
    // A reorder names Stores by id alone; another household's are left as they are.
    await expect(
      theirs.reorder({ stores: [{ id: store.id, version: store.version }] })
    ).resolves.toMatchObject({ stale: true });
    await expect(
      mine.update({ id: store.id, version: store.version, name: "Dirk" })
    ).resolves.toEqual({ success: true, stale: false });
    expect(
      (await repositories.stores.getStoreById(store.id, helpers.testHouseholdOf(admin.id)))?.name
    ).toBe("Dirk");
  });

  it("groceries: the household ticks a housemate's line, another household cannot", async () => {
    const grocery = await helpers.addTestGrocery(housemate.id, { name: "melk" });
    const mine = await as(routers.groceries, admin);
    const theirs = await as(routers.groceries, stranger);

    expect((await mine.list()).groceries.map((row) => row.id)).toEqual([grocery.id]);
    expect((await theirs.list()).groceries).toEqual([]);
    await expect(
      theirs.toggle({ groceries: [{ id: grocery.id, version: grocery.version }], isDone: true })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      theirs.delete({ groceries: [{ id: grocery.id, version: grocery.version }] })
    ).rejects.toThrow("FORBIDDEN");
    await mine.toggle({ groceries: [{ id: grocery.id, version: grocery.version }], isDone: true });
    expect((await mine.list()).groceries.map((row) => row.isDone)).toEqual([true]);
  });

  it("recurring groceries: another household cannot delete a household's", async () => {
    const { recurringGrocery } = await helpers.addTestRecurringGrocery(housemate.id, {
      name: "brood",
    });
    const theirs = await as(routers.groceries, stranger);
    const mine = await as(routers.groceries, admin);

    expect((await theirs.list()).recurringGroceries).toEqual([]);
    await expect(
      theirs.deleteRecurring({
        recurringGroceryId: recurringGrocery.id,
        version: recurringGrocery.version,
      })
    ).rejects.toThrow("FORBIDDEN");
    expect((await mine.list()).recurringGroceries.map((row) => row.id)).toEqual([
      recurringGrocery.id,
    ]);
  });

  it("pantry: a housemate's item is the household's, another household cannot remove it", async () => {
    const food = await helpers.mintTestFood("olijfolie");
    const item = await helpers.addTestPantryIngredient(housemate.id, food);
    const mine = await as(routers.pantry, admin);
    const theirs = await as(routers.pantry, stranger);

    expect((await mine.list()).map((row) => row.id)).toEqual([item.id]);
    expect(await theirs.list()).toEqual([]);
    await expect(theirs.remove({ id: item.id })).rejects.toThrow("FORBIDDEN");
    await expect(mine.remove({ id: item.id })).resolves.toBe(item.id);
    expect(await mine.list()).toEqual([]);
  });

  it("plan: a housemate's entry is the household's, another household cannot delete it", async () => {
    const entry = await repositories.planned.createPlannedItem({
      householdId: helpers.testHouseholdOf(admin.id),
      userId: housemate.id,
      date: DAY,
      slot: "Dinner",
      itemType: "note",
      title: "Soep",
    });
    const mine = await as(routers.calendar, admin);
    const theirs = await as(routers.calendar, stranger);
    const range = { startISO: DAY, endISO: DAY };

    expect((await mine.listItems(range)).map((row) => row.id)).toEqual([entry.id]);
    expect(await theirs.listItems(range)).toEqual([]);
    await expect(theirs.deleteItem({ itemId: entry.id, version: entry.version })).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(mine.deleteItem({ itemId: entry.id, version: entry.version })).resolves.toEqual({
      success: true,
      stale: false,
    });
  });

  it("a member who has left writes into their new household, never the old one", async () => {
    const store = await housemateStore();

    await repositories.households.moveToHouseholdOfOne(
      helpers.testHouseholdOf(admin.id),
      housemate.id
    );

    const left = await as(routers.stores, housemate);

    expect(await left.list()).toEqual([]);
    await expect(
      left.update({ id: store.id, version: store.version, name: "Taken" })
    ).rejects.toThrow("FORBIDDEN");
    await left.create({ id: crypto.randomUUID(), name: "Eigen" });
    expect((await (await as(routers.stores, admin)).list()).map((row) => row.name)).toEqual([
      "Markt",
    ]);
  });
});
