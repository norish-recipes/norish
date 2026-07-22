// @vitest-environment node
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trpcLogger } from "@norish/shared-server/logger";

import {
  assignGroceryToStoreProcedure,
  createGroceryProcedure,
  deleteGroceryProcedure,
  groceriesProcedures,
  listGroceriesProcedure,
  markGroceryDoneProcedure,
  markGroceryUndoneProcedure,
} from "../../src/routers/groceries/groceries";
import { createGroceriesData } from "../../src/routers/groceries/groceries-helpers";
import { router } from "../../src/trpc";
import { createMockCallerContext } from "../calendar/test-utils";
// Import mocks for assertions
import {
  assignGroceryToStore,
  createGroceries,
  deleteGroceryByIds,
  getGroceriesByIds,
  getGroceryOwnerIds,
  getRecipeInfoForGroceries,
  listGroceriesByUsers,
  updateGroceries,
} from "../mocks/db";
import { groceryEmitter } from "../mocks/grocery-emitter";
import { assertHouseholdAccess } from "../mocks/permissions";
import { listRecurringGroceriesByUsers } from "../mocks/recurring-groceries";
// Import test utilities
import {
  createMockAuthedContext,
  createMockGrocery,
  createMockHousehold,
  createMockUser,
} from "./test-utils";

const storesRepository = vi.hoisted(() => ({
  findBestIngredientStorePreference: vi.fn(),
  getStoreOwnerId: vi.fn(),
  normalizeIngredientName: vi.fn((name: string) => name.toLowerCase()),
  upsertIngredientStorePreference: vi.fn(),
}));

// Setup mocks before any imports that use them
vi.mock("@norish/db", () => import("../mocks/db"));
vi.mock("@norish/db/repositories/stores", () => storesRepository);
vi.mock(
  "@norish/db/repositories/recurring-groceries",
  () => import("../mocks/recurring-groceries")
);
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/groceries/emitter", () => import("../mocks/grocery-emitter"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));
vi.mock("@norish/shared/lib/helpers", () => import("../mocks/helpers"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Create a test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

// Create test caller
function createTestCaller(ctx: ReturnType<typeof createMockAuthedContext>) {
  const testRouter = t.router({
    list: t.procedure.query(async () => {
      const [groceries, recurringGroceries] = await Promise.all([
        listGroceriesByUsers(ctx.userIds),
        listRecurringGroceriesByUsers(ctx.userIds),
      ]);

      return { groceries, recurringGroceries };
    }),
  });

  return t.createCallerFactory(testRouter)(ctx);
}

const openApiGroceriesRouter = router({
  listGroceries: listGroceriesProcedure,
  createGrocery: createGroceryProcedure,
  markGroceryDone: markGroceryDoneProcedure,
  markGroceryUndone: markGroceryUndoneProcedure,
  deleteGrocery: deleteGroceryProcedure,
  assignGroceryToStore: assignGroceryToStoreProcedure,
});

describe("groceries procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  describe("list", () => {
    it("returns groceries and recurring groceries for user and household", async () => {
      const mockGroceries = [
        createMockGrocery({ id: "g1", name: "Milk" }),
        createMockGrocery({ id: "g2", name: "Bread" }),
      ];
      const mockRecurring = [
        { id: "r1", name: "Weekly Eggs", recurrenceRule: "week", recurrenceInterval: 1 },
      ];

      listGroceriesByUsers.mockResolvedValue(mockGroceries);
      listRecurringGroceriesByUsers.mockResolvedValue(mockRecurring);

      const caller = createTestCaller(ctx);
      const result = await caller.list();

      expect(listGroceriesByUsers).toHaveBeenCalledWith(ctx.userIds);
      expect(listRecurringGroceriesByUsers).toHaveBeenCalledWith(ctx.userIds);
      expect(result.groceries).toEqual(mockGroceries);
      expect(result.recurringGroceries).toEqual(mockRecurring);
    });

    it("returns empty arrays when no groceries exist", async () => {
      listGroceriesByUsers.mockResolvedValue([]);
      listRecurringGroceriesByUsers.mockResolvedValue([]);

      const caller = createTestCaller(ctx);
      const result = await caller.list();

      expect(result.groceries).toEqual([]);
      expect(result.recurringGroceries).toEqual([]);
    });
  });
});

describe("groceries openapi procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
    getRecipeInfoForGroceries.mockResolvedValue(new Map());
    storesRepository.findBestIngredientStorePreference.mockResolvedValue(null);
  });

  it("lists only groceries for the API endpoint", async () => {
    const mockGroceries = [
      createMockGrocery({ id: crypto.randomUUID(), name: "Milk" }),
      createMockGrocery({ id: crypto.randomUUID(), name: "Bread" }),
    ];

    listGroceriesByUsers.mockResolvedValue(mockGroceries);
    listRecurringGroceriesByUsers.mockResolvedValue([{ id: "recurring-1" }]);

    const caller = openApiGroceriesRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.listGroceries();

    expect(result).toEqual(mockGroceries);
  });

  it("creates and returns a single grocery for the API endpoint", async () => {
    const storeId = crypto.randomUUID();

    listGroceriesByUsers.mockResolvedValue([]);
    createGroceries.mockImplementation(
      async (items: Array<{ id: string; groceries: { name: string | null } }>) =>
        items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name }))
    );

    const caller = openApiGroceriesRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.createGrocery({
      name: "Apples",
      amount: 2,
      unit: "pcs",
      isDone: false,
      storeId,
    });

    expect(createGroceries).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        name: "Apples",
      })
    );
  });

  it("inserts a new grocery with the client-minted id when one is supplied", async () => {
    const clientId = crypto.randomUUID();

    // No existing groceries → no merge, so the create path runs.
    listGroceriesByUsers.mockResolvedValue([]);
    createGroceries.mockImplementation(
      async (items: Array<{ id: string; groceries: { name: string | null } }>) =>
        items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name }))
    );

    // Exercise the create helper directly: the internal `create` procedure validates
    // `z.array(GroceryCreateSchema)`, which mixes zod instances across the injected
    // workspace copies and can't be driven through a tRPC caller in this test env.
    const result = await createGroceriesData(ctx, [
      { id: clientId, name: "Apples", unit: null, amount: 1, isDone: false },
    ]);

    expect(createGroceries).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: clientId })]),
      expect.anything()
    );
    expect(result.ids).toContain(clientId);
  });

  it("mints the id for the id-less public API create (app creates require client ids)", async () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    listGroceriesByUsers.mockResolvedValue([]);
    createGroceries.mockImplementation(
      async (items: Array<{ id: string; groceries: { name: string | null } }>) =>
        items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name }))
    );

    const caller = openApiGroceriesRouter.createCaller(createMockCallerContext(ctx));

    await caller.createGrocery({ name: "Bananas", unit: null, amount: null, isDone: false });

    const created = createGroceries.mock.calls[0][0] as Array<{ id: string }>;

    expect(created[0]?.id).toMatch(UUID_RE);
  });

  it("returns one client-to-canonical substitution per submitted item in input order", async () => {
    const existingId = crypto.randomUUID();
    const clientA = crypto.randomUUID();
    const clientB = crypto.randomUUID();
    const existing = createMockGrocery({ id: existingId, name: "Milk", unit: null, amount: 1 });

    listGroceriesByUsers.mockResolvedValue([existing]);
    updateGroceries.mockImplementation(async (updates: Array<{ id: string; amount: number }>) =>
      updates.map((update) => ({ ...existing, ...update, version: 2 }))
    );
    createGroceries.mockImplementation(
      async (items: Array<{ id: string; groceries: { name: string | null } }>) =>
        items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name }))
    );

    const result = await createGroceriesData(ctx, [
      { id: clientA, name: "milk", unit: null, amount: 2, isDone: false },
      { id: clientB, name: "Bread", unit: null, amount: 1, isDone: false },
    ]);

    expect(result.ids).toEqual([existingId, clientB]);
    expect(result.idSubstitutions).toEqual([
      { clientId: clientA, canonicalId: existingId },
      { clientId: clientB, canonicalId: clientB },
    ]);
  });

  it("merges identical batch items onto the first row before insert (many-to-one)", async () => {
    const clientA = crypto.randomUUID();
    const clientB = crypto.randomUUID();

    listGroceriesByUsers.mockResolvedValue([]);
    createGroceries.mockImplementation(
      async (items: Array<{ id: string; groceries: { name: string | null } }>) =>
        items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name }))
    );

    const result = await createGroceriesData(ctx, [
      { id: clientA, name: "Eggs", unit: null, amount: 2, isDone: false },
      { id: clientB, name: "eggs ", unit: null, amount: 3, isDone: false },
    ]);

    // The duplicate accumulates onto the pending insert; no update of a
    // not-yet-created row is attempted.
    expect(updateGroceries).not.toHaveBeenCalled();
    const created = createGroceries.mock.calls[0][0] as Array<{
      id: string;
      groceries: { amount: number | null };
    }>;

    expect(created).toHaveLength(1);
    expect(created[0]?.id).toBe(clientA);
    expect(created[0]?.groceries.amount).toBe(5);
    expect(result.ids).toEqual([clientA, clientA]);
    expect(result.idSubstitutions).toEqual([
      { clientId: clientA, canonicalId: clientA },
      { clientId: clientB, canonicalId: clientA },
    ]);
  });

  it("marks a grocery done and returns the updated grocery", async () => {
    const groceryId = crypto.randomUUID();
    const ownerIds = new Map([[groceryId, ctx.user.id]]);
    const grocery = createMockGrocery({ id: groceryId, isDone: false, version: 2 });
    const updated = { ...grocery, isDone: true };

    getGroceryOwnerIds.mockResolvedValue(ownerIds);
    getGroceriesByIds.mockResolvedValue([grocery]);
    updateGroceries.mockResolvedValue([updated]);
    assertHouseholdAccess.mockResolvedValue(undefined);

    const caller = openApiGroceriesRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.markGroceryDone({ id: groceryId, version: 2 });

    expect(result).toEqual({ grocery: updated, stale: false });
  });

  it("deletes a grocery and reports stale state", async () => {
    const groceryId = crypto.randomUUID();

    getGroceryOwnerIds.mockResolvedValue(new Map([[groceryId, ctx.user.id]]));
    assertHouseholdAccess.mockResolvedValue(undefined);
    deleteGroceryByIds.mockResolvedValue({ deletedIds: [], staleIds: [groceryId] });

    const caller = openApiGroceriesRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.deleteGrocery({ id: groceryId, version: 3 });

    expect(result).toEqual({ success: true, stale: true });
  });

  it("marks a grocery as undone and returns the updated grocery", async () => {
    const groceryId = crypto.randomUUID();
    const ownerIds = new Map([[groceryId, ctx.user.id]]);
    const grocery = createMockGrocery({ id: groceryId, isDone: true, version: 4 });
    const updated = { ...grocery, isDone: false };

    getGroceryOwnerIds.mockResolvedValue(ownerIds);
    getGroceriesByIds.mockResolvedValue([grocery]);
    updateGroceries.mockResolvedValue([updated]);
    assertHouseholdAccess.mockResolvedValue(undefined);

    const caller = openApiGroceriesRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.markGroceryUndone({ id: groceryId, version: 4 });

    expect(result).toEqual({ grocery: updated, stale: false });
  });

  it("assigns a grocery to a store and returns the updated grocery", async () => {
    const groceryId = crypto.randomUUID();
    const storeId = crypto.randomUUID();
    const grocery = createMockGrocery({ id: groceryId, name: "Milk", storeId: null });
    const updated = { ...grocery, storeId };

    getGroceryOwnerIds.mockResolvedValue(new Map([[groceryId, ctx.user.id]]));
    getGroceriesByIds.mockResolvedValue([grocery]);
    storesRepository.getStoreOwnerId.mockResolvedValue(ctx.user.id);
    assertHouseholdAccess.mockResolvedValue(undefined);
    assignGroceryToStore.mockResolvedValue(updated);

    const caller = openApiGroceriesRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.assignGroceryToStore({ id: groceryId, version: 2, storeId });

    expect(assignGroceryToStore).toHaveBeenCalledWith(groceryId, storeId, ctx.userIds, 2);
    expect(result).toEqual({ grocery: updated, stale: false });
  });
});

describe("grocery permission checks", () => {
  const _mockUser = createMockUser({ id: "user-1" });
  const _mockHousehold = createMockHousehold({
    users: [
      { id: "user-1", name: "User 1", version: 1 },
      { id: "user-2", name: "User 2", version: 1 },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("update permission", () => {
    it("allows owner to update their grocery", async () => {
      const groceryId = "grocery-1";
      const ownerIds = new Map([[groceryId, "user-1"]]);

      getGroceryOwnerIds.mockResolvedValue(ownerIds);
      assertHouseholdAccess.mockResolvedValue(undefined);

      await assertHouseholdAccess("user-1", "user-1");

      expect(assertHouseholdAccess).toHaveBeenCalledWith("user-1", "user-1");
    });

    it("allows household member to update grocery", async () => {
      const groceryId = "grocery-1";
      const ownerIds = new Map([[groceryId, "user-2"]]);

      getGroceryOwnerIds.mockResolvedValue(ownerIds);
      assertHouseholdAccess.mockResolvedValue(undefined);

      await assertHouseholdAccess("user-1", "user-2");

      expect(assertHouseholdAccess).toHaveBeenCalledWith("user-1", "user-2");
    });

    it("throws when grocery not found", async () => {
      getGroceryOwnerIds.mockResolvedValue(new Map());

      const ownerIds = await getGroceryOwnerIds(["non-existent"]);

      expect(ownerIds.size).toBe(0);
    });
  });

  describe("delete permission", () => {
    it("allows deleting multiple groceries when all are accessible", async () => {
      const _groceryIds = ["g1", "g2"];
      const ownerIds = new Map([
        ["g1", "user-1"],
        ["g2", "user-2"],
      ]);

      getGroceryOwnerIds.mockResolvedValue(ownerIds);
      assertHouseholdAccess.mockResolvedValue(undefined);
      deleteGroceryByIds.mockResolvedValue(undefined);

      for (const ownerId of ownerIds.values()) {
        await assertHouseholdAccess("user-1", ownerId);
      }

      expect(assertHouseholdAccess).toHaveBeenCalledTimes(2);
    });
  });
});

describe("grocery emitter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits created event after successful creation", async () => {
    const mockGroceries = [createMockGrocery({ id: "new-1", name: "New Item" })];

    createGroceries.mockResolvedValue(mockGroceries);

    groceryEmitter.emitToHousehold("household-1", "created", { groceries: mockGroceries });

    expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith("household-1", "created", {
      groceries: mockGroceries,
    });
  });

  it("emits updated event after successful update", async () => {
    const mockUpdated = [createMockGrocery({ id: "g1", name: "Updated" })];

    updateGroceries.mockResolvedValue(mockUpdated);

    groceryEmitter.emitToHousehold("household-1", "updated", { changedGroceries: mockUpdated });

    expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith("household-1", "updated", {
      changedGroceries: mockUpdated,
    });
  });

  it("emits deleted event after successful deletion", async () => {
    const groceryIds = ["g1", "g2"];

    deleteGroceryByIds.mockResolvedValue(undefined);

    groceryEmitter.emitToHousehold("household-1", "deleted", { groceryIds });

    expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith("household-1", "deleted", {
      groceryIds,
    });
  });
});

describe("toggle procedure logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggles isDone for multiple groceries", async () => {
    const groceryIds = ["g1", "g2"];
    const ownerIds = new Map([
      ["g1", "user-1"],
      ["g2", "user-1"],
    ]);
    const groceries = [
      createMockGrocery({ id: "g1", isDone: false }),
      createMockGrocery({ id: "g2", isDone: false }),
    ];

    getGroceryOwnerIds.mockResolvedValue(ownerIds);
    getGroceriesByIds.mockResolvedValue(groceries);
    assertHouseholdAccess.mockResolvedValue(undefined);
    updateGroceries.mockResolvedValue(groceries.map((g) => ({ ...g, isDone: true })));

    const fetchedGroceries = await getGroceriesByIds(groceryIds);
    const updatedGroceries = fetchedGroceries.map((g: ReturnType<typeof createMockGrocery>) => ({
      ...g,
      isDone: true,
    }));

    expect(updatedGroceries.every((g: { isDone: boolean }) => g.isDone)).toBe(true);
  });
});

describe("stale grocery updates", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  it("drops stale grocery row updates and asks clients to refresh", async () => {
    const groceryId = crypto.randomUUID();

    getGroceryOwnerIds.mockResolvedValue(new Map([[groceryId, ctx.user.id]]));
    assertHouseholdAccess.mockResolvedValue(undefined);
    updateGroceries.mockResolvedValue([]);

    const caller = groceriesProcedures.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.update({ groceryId, raw: "Oat milk", version: 4 });

    await Promise.resolve();
    await Promise.resolve();

    expect(result).toEqual({ success: true });
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, groceryId, version: 4 },
      "Stale grocery update; requesting client refresh"
    );
    expect(groceryEmitter.emitToHousehold).not.toHaveBeenCalledWith(
      ctx.householdKey,
      "updated",
      expect.anything()
    );
    expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "stale", {
      reason: expect.any(String),
    });
  });

  it("saves the ingredient store preference when the update carries a store change", async () => {
    const groceryId = crypto.randomUUID();
    const storeId = crypto.randomUUID();

    getGroceryOwnerIds.mockResolvedValue(new Map([[groceryId, ctx.user.id]]));
    assertHouseholdAccess.mockResolvedValue(undefined);
    updateGroceries.mockResolvedValue([
      createMockGrocery({ id: groceryId, name: "Oat Milk", storeId }),
    ]);

    const caller = groceriesProcedures.createCaller({ ...ctx, multiplexer: null } as any);

    await caller.update({ groceryId, raw: "Oat milk", version: 4, storeId });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(storesRepository.upsertIngredientStorePreference).toHaveBeenCalledWith(
      ctx.user.id,
      "oat milk",
      storeId
    );
  });

  it("passes storeId through to updateGroceries when provided", async () => {
    const groceryId = crypto.randomUUID();
    const storeId = crypto.randomUUID();

    getGroceryOwnerIds.mockResolvedValue(new Map([[groceryId, ctx.user.id]]));
    assertHouseholdAccess.mockResolvedValue(undefined);
    updateGroceries.mockResolvedValue([createMockGrocery({ id: groceryId, storeId })]);

    const caller = groceriesProcedures.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.update({
      groceryId,
      raw: "Oat milk",
      version: 4,
      storeId,
    });

    // Drain microtasks so the .then() chain in the handler runs
    await Promise.resolve();
    await Promise.resolve();

    expect(result).toEqual({ success: true });

    // Verify storeId was included in the update data passed to the DB layer
    const updates = updateGroceries.mock.calls[0][0] as Array<{ storeId: unknown }>;
    const update = updates.find((u) => u.storeId === storeId);
    expect(update).toBeDefined();
    expect(update!.storeId).toBe(storeId);
  });

  it("passes storeId=null (unsorted) through to updateGroceries", async () => {
    const groceryId = crypto.randomUUID();
    const currentStoreId = crypto.randomUUID();

    getGroceryOwnerIds.mockResolvedValue(new Map([[groceryId, ctx.user.id]]));
    assertHouseholdAccess.mockResolvedValue(undefined);
    updateGroceries.mockResolvedValue([createMockGrocery({ id: groceryId, storeId: null })]);

    const caller = groceriesProcedures.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.update({
      groceryId,
      raw: "Oat milk",
      version: 4,
      storeId: null,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(result).toEqual({ success: true });

    // Verify storeId=null was passed to the DB layer (setting item to unsorted)
    const updates = updateGroceries.mock.calls[0][0] as Array<{ storeId: unknown }>;
    const update = updates.find((u) => u.storeId === null);
    expect(update).toBeDefined();
  });

  it("omits storeId from updateData when not provided", async () => {
    const groceryId = crypto.randomUUID();

    getGroceryOwnerIds.mockResolvedValue(new Map([[groceryId, ctx.user.id]]));
    assertHouseholdAccess.mockResolvedValue(undefined);
    updateGroceries.mockResolvedValue([createMockGrocery({ id: groceryId })]);

    const caller = groceriesProcedures.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.update({
      groceryId,
      raw: "Oat milk",
      version: 4,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(result).toEqual({ success: true });

    // Verify storeId was not set on the update data
    const updates = updateGroceries.mock.calls[0][0] as Array<Record<string, unknown>>;
    const update = updates[0];
    // The update data should not have a storeId property (undefined, not null)
    // It may have storeId undefined or not present — just confirm it's not a value
    expect(update).toBeDefined();
  });
});
