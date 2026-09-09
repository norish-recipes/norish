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
import { assertHouseholdAccess } from "../mocks/permissions";

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

const storeEmitter = vi.hoisted(() => ({
  emitToHousehold: vi.fn(),
}));

const groceryEmitter = vi.hoisted(() => ({
  emitToHousehold: vi.fn(),
}));

vi.mock("@norish/db/repositories/stores", () => storesRepository);
vi.mock("@norish/queue/api-handlers", () => ({
  requireQueueApiHandler: (name: keyof typeof shop) => shop[name],
}));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/stores/emitter", () => ({ storeEmitter }));
vi.mock("@norish/trpc/routers/groceries/emitter", () => ({ groceryEmitter }));
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
    vi.clearAllMocks();
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

  it("logs stale store updates as no-ops", async () => {
    storesRepository.updateStore.mockResolvedValue(null);

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.update({
      id: crypto.randomUUID(),
      version: 3,
      name: "Pantry",
    });

    expect(result).toBeDefined();
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, storeId: result, version: 3 },
      "Ignoring stale store update mutation"
    );
    expect(storeEmitter.emitToHousehold).not.toHaveBeenCalled();
  });

  it("logs stale store reorders as no-ops", async () => {
    const storeId = crypto.randomUUID();

    storesRepository.reorderStores.mockResolvedValue([]);

    const caller = storesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.reorder({ stores: [{ id: storeId, version: 2 }] });

    expect(result).toEqual([storeId]);
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, requestedStoreCount: 1 },
      "Ignoring stale store reorder mutation"
    );
    expect(storeEmitter.emitToHousehold).not.toHaveBeenCalled();
  });

  it("logs partial store reorders and emits only applied stores", async () => {
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

    expect(result).toEqual([storeA, storeB]);
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, requestedStoreCount: 2, appliedStoreCount: 1 },
      "Store reorder partially applied due to stale versions"
    );
    expect(storeEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "reordered", {
      stores: [reorderedStore],
    });
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
    expect(storeEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "updated", {
      store: saved,
    });
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
    expect(storeEmitter.emitToHousehold).not.toHaveBeenCalled();
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
    expect(storeEmitter.emitToHousehold).toHaveBeenCalledWith(
      ctx.householdKey,
      "created",
      expect.objectContaining({
        store: expect.objectContaining({ aisles: [expect.objectContaining({ name: "Zuivel" })] }),
      })
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
    expect(storeEmitter.emitToHousehold).toHaveBeenCalledWith(
      ctx.householdKey,
      "created",
      expect.objectContaining({
        store: expect.objectContaining({ name: "Market" }),
      })
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
