// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trpcLogger } from "@norish/shared-server/logger";

import {
  createStoreProcedure,
  listStoresProcedure,
  storesProcedures,
} from "../../src/routers/stores/stores";
import { router } from "../../src/trpc";
import {
  createMockAuthedContext,
  createMockCallerContext,
  createMockHousehold,
  createMockUser,
} from "../calendar/test-utils";
import { createMockGrocery } from "../groceries/test-utils";
import { assertHouseholdAccess } from "../mocks/permissions";
import { groceries } from "../mocks/realtime/groceries";
import { stores } from "../mocks/realtime/stores";

const storesRepository = vi.hoisted(() => ({
  checkStoreNameExistsInHousehold: vi.fn(),
  countGroceriesInStore: vi.fn(),
  createStore: vi.fn(),
  deleteStore: vi.fn(),
  getStoreById: vi.fn(),
  getStoreOwnerId: vi.fn(),
  listStoresByUserIds: vi.fn(),
  reorderStores: vi.fn(),
  updateStore: vi.fn(),
}));

const shop = vi.hoisted(() => ({
  discoverSearchAddress: vi.fn(),
  verifySearchAddress: vi.fn(),
}));

vi.mock("@norish/db/repositories/stores", () => storesRepository);
vi.mock("@norish/queue/api-handlers", () => ({
  requireQueueApiHandler: (name: keyof typeof shop) => shop[name],
}));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/realtime/stores", () => import("../mocks/realtime/stores"));
vi.mock("@norish/shared-server/realtime/groceries", () => import("../mocks/realtime/groceries"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const openApiStoresRouter = router({
  listStores: listStoresProcedure,
  createStore: createStoreProcedure,
});

describe("stores procedures", () => {
  const user = createMockUser();
  const household = createMockHousehold();
  const ctx = createMockAuthedContext(user, household);

  beforeEach(() => {
    storesRepository.getStoreOwnerId.mockResolvedValue(ctx.user.id);
    assertHouseholdAccess.mockResolvedValue(undefined);
  });

  it("checks the link the client just saved, not the one it replaced", async () => {
    // The update and the check ride the same batch; the check may read the
    // row before the update has written it. A Search Address the shopper
    // replaced with a homepage is gone, and the homepage is where to look.
    const storeId = crypto.randomUUID();

    storesRepository.getStoreById.mockResolvedValue({
      id: storeId,
      userId: ctx.user.id,
      website: "https://old.example.nl",
      searchAddress: "https://old.example.nl/zoeken?q={query}",
    });
    storesRepository.updateStore.mockResolvedValue({ id: storeId });
    shop.discoverSearchAddress.mockResolvedValue("https://new.example.nl/search?q={query}");
    shop.verifySearchAddress.mockResolvedValue({ outcome: "products", count: 3 });

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.checkSearchAddress({
      storeId,
      term: null,
      searchAddress: null,
      website: "https://new.example.nl",
    });

    expect(shop.discoverSearchAddress).toHaveBeenCalledWith("https://new.example.nl");
    expect(shop.verifySearchAddress).toHaveBeenCalledWith(
      "https://new.example.nl/search?q={query}",
      null
    );
    expect(result).toMatchObject({
      searchAddress: "https://new.example.nl/search?q={query}",
      outcome: "products",
    });
  });

  it("answers a stale store update as stale, and changes nothing", async () => {
    storesRepository.updateStore.mockResolvedValue(null);
    const storeId = crypto.randomUUID();

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.update({ id: storeId, version: 3, name: "Pantry" });

    expect(result).toEqual({ success: true, stale: true });
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, storeId, version: 3 },
      "Ignoring stale store update mutation"
    );
    expect(stores.publish).not.toHaveBeenCalled();
  });

  it("answers an applied store update as not stale and tells the household", async () => {
    const storeId = crypto.randomUUID();

    storesRepository.updateStore.mockResolvedValue({ id: storeId, version: 4 });

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.update({ id: storeId, version: 3, name: "Pantry" });

    expect(result).toEqual({ success: true, stale: false });
    expect(stores.publish).toHaveBeenCalledWith(
      "updated",
      { store: { id: storeId, version: 4 } },
      { householdId: ctx.householdId }
    );
  });

  it("answers an update to a Store that no longer exists as stale", async () => {
    storesRepository.getStoreOwnerId.mockResolvedValue(null);

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));

    await expect(
      caller.update({ id: crypto.randomUUID(), version: 3, name: "Pantry" })
    ).resolves.toEqual({ success: true, stale: true });
    expect(storesRepository.updateStore).not.toHaveBeenCalled();
  });

  it("fails an update the database refused, so it is never taken as stored", async () => {
    storesRepository.updateStore.mockRejectedValue(new Error("connection lost"));

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));

    await expect(
      caller.update({ id: crypto.randomUUID(), version: 3, name: "Pantry" })
    ).rejects.toThrow("connection lost");
  });

  it("answers a delete once decided: stale when the version moved on", async () => {
    storesRepository.deleteStore.mockResolvedValue({
      deletedGroceryIds: [],
      movedGroceries: [],
      storeDeleted: false,
      stale: true,
    });

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.delete({
      storeId: crypto.randomUUID(),
      version: 2,
      deleteGroceries: false,
      grocerySnapshot: [],
    });

    expect(result).toEqual({ success: true, stale: true });
    expect(stores.publish).not.toHaveBeenCalled();
  });

  it("answers a delete that kept the Store for lines it was not shown as stale", async () => {
    storesRepository.deleteStore.mockResolvedValue({
      deletedGroceryIds: [],
      movedGroceries: [],
      storeDeleted: false,
      stale: false,
    });

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.delete({
      storeId: crypto.randomUUID(),
      version: 2,
      deleteGroceries: true,
      grocerySnapshot: [{ id: crypto.randomUUID(), version: 1 }],
    });

    expect(result).toEqual({ success: true, stale: true });
  });

  it("answers an applied delete as not stale and tells the household", async () => {
    const storeId = crypto.randomUUID();
    const groceryId = crypto.randomUUID();

    storesRepository.deleteStore.mockResolvedValue({
      deletedGroceryIds: [groceryId],
      movedGroceries: [],
      storeDeleted: true,
      stale: false,
    });

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.delete({
      storeId,
      version: 2,
      deleteGroceries: true,
      grocerySnapshot: [{ id: groceryId, version: 1 }],
    });

    expect(result).toEqual({ success: true, stale: false });
    expect(stores.publish).toHaveBeenCalledWith(
      "deleted",
      { storeId, deletedGroceryIds: [groceryId] },
      { householdId: ctx.householdId }
    );
    expect(groceries.publish).toHaveBeenCalledWith(
      "deleted",
      { groceryIds: [groceryId] },
      { householdId: ctx.householdId }
    );
  });

  it.each([
    ["deleting the Store", true],
    ["keeping the Store for lines it was not shown", false],
  ])("tells the household of the lines a delete moved to Unsorted, %s", async (_, storeDeleted) => {
    const moved = createMockGrocery({ id: crypto.randomUUID(), storeId: null, version: 2 });

    storesRepository.deleteStore.mockResolvedValue({
      deletedGroceryIds: [],
      movedGroceries: [moved],
      storeDeleted,
      stale: false,
    });

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));

    await caller.delete({
      storeId: crypto.randomUUID(),
      version: 2,
      deleteGroceries: false,
      grocerySnapshot: [{ id: moved.id, version: 1 }],
    });

    expect(groceries.publish).toHaveBeenCalledWith(
      "updated",
      { changedGroceries: [moved] },
      { householdId: ctx.householdId }
    );
  });

  it("takes a delete of a Store already gone as done", async () => {
    storesRepository.getStoreOwnerId.mockResolvedValue(null);

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));

    await expect(
      caller.delete({
        storeId: crypto.randomUUID(),
        version: 2,
        deleteGroceries: false,
        grocerySnapshot: [],
      })
    ).resolves.toEqual({ success: true, stale: false });
    expect(storesRepository.deleteStore).not.toHaveBeenCalled();
  });

  it("answers a reorder none of whose versions held as stale", async () => {
    storesRepository.reorderStores.mockResolvedValue([]);

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.reorder({ stores: [{ id: crypto.randomUUID(), version: 2 }] });

    expect(result).toEqual({ success: true, stale: true });
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, requestedStoreCount: 1 },
      "Ignoring stale store reorder mutation"
    );
    expect(stores.publish).not.toHaveBeenCalled();
  });

  it("answers a partial store reorder as stale and emits only the applied stores", async () => {
    const storeA = crypto.randomUUID();
    const storeB = crypto.randomUUID();
    const reorderedStore = {
      id: storeA,
      name: "Pantry",
      color: "primary",
      sortOrder: 0,
      version: 3,
    };

    storesRepository.reorderStores.mockResolvedValue([reorderedStore]);

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.reorder({
      stores: [
        { id: storeA, version: 1 },
        { id: storeB, version: 4 },
      ],
    });

    expect(result).toEqual({ success: true, stale: true });
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, requestedStoreCount: 2, appliedStoreCount: 1 },
      "Store reorder partially applied due to stale versions"
    );
    expect(stores.publish).toHaveBeenCalledWith(
      "reordered",
      {
        stores: [reorderedStore],
      },
      { householdId: ctx.householdId }
    );
  });

  it("answers a whole reorder as not stale, and a failed one as failed", async () => {
    const storeId = crypto.randomUUID();

    storesRepository.reorderStores.mockResolvedValue([{ id: storeId, version: 2 }]);
    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));

    await expect(caller.reorder({ stores: [{ id: storeId, version: 2 }] })).resolves.toEqual({
      success: true,
      stale: false,
    });

    storesRepository.reorderStores.mockRejectedValue(new Error("connection lost"));
    await expect(caller.reorder({ stores: [{ id: storeId, version: 2 }] })).rejects.toThrow(
      "connection lost"
    );
  });

  it("saves a Store's aisles with it and tells the household the Store, aisles and all", async () => {
    // Every Store event carries the Store as the repository handed it back,
    // aisles included, and the client merges it by store id (ADR-0031).
    const storeId = crypto.randomUUID();
    const zuivel = crypto.randomUUID();
    const brood = crypto.randomUUID();
    const saved = {
      id: storeId,
      userId: ctx.user.id,
      name: "Dirk",
      color: "primary",
      website: null,
      searchAddress: null,
      sortOrder: 0,
      version: 2,
      aisles: [
        { id: zuivel, storeId, name: "Zuivel", sortOrder: 0, version: 1 },
        { id: brood, storeId, name: "Brood", sortOrder: 1, version: 1 },
      ],
    };

    storesRepository.checkStoreNameExistsInHousehold.mockResolvedValue(false);
    storesRepository.updateStore.mockResolvedValue(saved);

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));

    await caller.update({
      id: storeId,
      version: 1,
      aisles: [
        { id: zuivel, name: "Zuivel" },
        { id: brood, name: "Brood" },
      ],
    });

    expect(storesRepository.updateStore).toHaveBeenCalledWith(
      expect.objectContaining({
        id: storeId,
        aisles: [
          { id: zuivel, name: "Zuivel" },
          { id: brood, name: "Brood" },
        ],
      })
    );
    expect(stores.publish).toHaveBeenCalledWith(
      "updated",
      {
        store: saved,
      },
      { householdId: ctx.householdId }
    );
  });

  it("refuses two aisles whose names differ only in case, before anything is written", async () => {
    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));

    await expect(
      caller.update({
        id: crypto.randomUUID(),
        version: 1,
        aisles: [
          { id: crypto.randomUUID(), name: "Zuivel" },
          { id: crypto.randomUUID(), name: "zuivel " },
        ],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(storesRepository.updateStore).not.toHaveBeenCalled();
    expect(stores.publish).not.toHaveBeenCalled();
  });

  it("creates a Store with its aisles in one go", async () => {
    const zuivel = crypto.randomUUID();

    storesRepository.checkStoreNameExistsInHousehold.mockResolvedValue(false);
    storesRepository.createStore.mockImplementation(
      async (id: string, data: Record<string, unknown>) => ({
        id,
        ...data,
        version: 1,
        aisles: [{ id: zuivel, storeId: id, name: "Zuivel", sortOrder: 0, version: 1 }],
      })
    );

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));

    await caller.create({ name: "Dirk", aisles: [{ id: zuivel, name: "Zuivel" }] });

    expect(storesRepository.createStore).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: "Dirk", aisles: [{ id: zuivel, name: "Zuivel" }] })
    );
    expect(stores.publish).toHaveBeenCalledWith(
      "created",
      expect.objectContaining({
        store: expect.objectContaining({ aisles: [expect.objectContaining({ name: "Zuivel" })] }),
      }),
      { householdId: ctx.householdId }
    );
  });

  it("lists stores for the API endpoint", async () => {
    const stores = [
      {
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        name: "Pantry",
        color: "primary",
        website: null,
        searchAddress: null,
        sortOrder: 0,
        version: 1,
        aisles: [],
      },
    ];

    storesRepository.listStoresByUserIds.mockResolvedValue(stores);

    const caller = openApiStoresRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.listStores();

    expect(result).toEqual(stores);
  });

  it("creates and returns a store for the API endpoint, with no aisles", async () => {
    storesRepository.checkStoreNameExistsInHousehold.mockResolvedValue(false);
    storesRepository.createStore.mockImplementation(
      async (id: string, data: Record<string, unknown>) => ({
        id,
        ...data,
        version: 1,
        aisles: [],
      })
    );

    const caller = openApiStoresRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.createStore({
      name: "Market",
      color: "primary",
    });

    expect(result).toEqual(
      expect.objectContaining({
        name: "Market",
        userId: ctx.user.id,
        aisles: [],
      })
    );
    // The REST create knows nothing of aisles: a Store made through it has none.
    expect(storesRepository.createStore).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({ aisles: expect.anything() })
    );
    expect(stores.publish).toHaveBeenCalledWith(
      "created",
      expect.objectContaining({
        store: expect.objectContaining({ name: "Market" }),
      }),
      { householdId: ctx.householdId }
    );
  });

  it("accepts a create that still sends an icon, and the Store made carries none", async () => {
    // A Store once had an icon. A client built before it went, or a REST
    // caller, may still send one; it is dropped rather than refused, and the
    // Store is created without it.
    storesRepository.checkStoreNameExistsInHousehold.mockResolvedValue(false);
    storesRepository.createStore.mockImplementation(
      async (id: string, data: Record<string, unknown>) => ({ id, ...data, version: 1, aisles: [] })
    );

    const caller = openApiStoresRouter.createCaller(createMockCallerContext(ctx));
    const sent: Record<string, unknown> = { name: "Market", icon: "ShoppingBagIcon" };
    const result = await caller.createStore(sent);

    expect(result).toEqual(expect.objectContaining({ name: "Market" }));
    expect(result).not.toHaveProperty("icon");
    expect(storesRepository.createStore).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({ icon: expect.anything() })
    );
  });

  it("inserts the store with the client-minted id when one is supplied", async () => {
    const clientId = crypto.randomUUID();

    storesRepository.checkStoreNameExistsInHousehold.mockResolvedValue(false);
    storesRepository.createStore.mockImplementation(
      async (id: string, data: Record<string, unknown>) => ({ id, ...data, version: 1, aisles: [] })
    );

    const caller = openApiStoresRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.createStore({
      id: clientId,
      name: "Market",
      color: "primary",
    });

    expect(storesRepository.createStore).toHaveBeenCalledWith(clientId, expect.anything());
    expect(result).toEqual(expect.objectContaining({ id: clientId }));
  });
});
