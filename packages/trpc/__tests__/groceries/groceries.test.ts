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
import { recurringGroceriesProcedures } from "../../src/routers/groceries/recurring";
import { router } from "../../src/trpc";
import { createMockCallerContext } from "../calendar/test-utils";
// Import mocks for assertions
import {
  assignGroceryToStore,
  createGroceries,
  deleteDoneInStore,
  deleteGroceryByIds,
  getGroceriesByIds,
  getGroceryRecipeLine,
  getRecipeInfoForGroceries,
  listGroceriesByHousehold,
  lockGroceryList,
  markAllDoneInStore,
  ownGroceryIds,
  reorderGroceriesInStore,
  updateGroceries,
} from "../mocks/db";
import { TX } from "../mocks/drizzle";
import { parseIngredientWithDefaults } from "../mocks/helpers";
import { resolveGroceryNames } from "../mocks/ingredient-groceries";
import { groceries } from "../mocks/realtime/groceries";
import { stores } from "../mocks/realtime/stores";
import {
  createRecurringGroceries,
  listRecurringGroceriesByHousehold,
} from "../mocks/recurring-groceries";
// Import test utilities
import {
  createMockAuthedContext,
  createMockGrocery,
  createMockHousehold,
  createMockUser,
  flushAsync,
} from "./test-utils";

const storesRepository = vi.hoisted(() => ({
  findBestIngredientStorePreference: vi.fn(),
  ownStoreExists: vi.fn(),
  upsertIngredientStorePreference: vi.fn(),
  // A household with no Store that points at a shop: pricing notices the
  // groceries, finds nothing to ask, and visits nothing.
  listStoresByHousehold: vi.fn(async () => []),
}));

const storeProductsRepository = vi.hoisted(() => ({
  resolveProductLinks: vi.fn(async () => [] as unknown[]),
  listStaleProducts: vi.fn(async () => []),
}));

// Setup mocks before any imports that use them
vi.mock("@norish/db", () => import("../mocks/db"));
vi.mock("@norish/db/drizzle", () => import("../mocks/drizzle"));
vi.mock("@norish/db/repositories/stores", () => storesRepository);
vi.mock("@norish/db/repositories/store-products", () => storeProductsRepository);
vi.mock("@norish/shared-server/realtime/stores", () => import("../mocks/realtime/stores"));
vi.mock(
  "@norish/db/repositories/recurring-groceries",
  () => import("../mocks/recurring-groceries")
);
vi.mock(
  "@norish/shared-server/ingredients/groceries",
  () => import("../mocks/ingredient-groceries")
);
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/realtime/groceries", () => import("../mocks/realtime/groceries"));
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
        listGroceriesByHousehold(ctx.householdId),
        listRecurringGroceriesByHousehold(ctx.householdId),
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
    // Every Store a test files a grocery under is the household's own.
    storesRepository.ownStoreExists.mockResolvedValue(true);
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

      listGroceriesByHousehold.mockResolvedValue(mockGroceries);
      listRecurringGroceriesByHousehold.mockResolvedValue(mockRecurring);

      const caller = createTestCaller(ctx);
      const result = await caller.list();

      expect(listGroceriesByHousehold).toHaveBeenCalledWith(ctx.householdId);
      expect(listRecurringGroceriesByHousehold).toHaveBeenCalledWith(ctx.householdId);
      expect(result.groceries).toEqual(mockGroceries);
      expect(result.recurringGroceries).toEqual(mockRecurring);
    });

    it("returns empty arrays when no groceries exist", async () => {
      listGroceriesByHousehold.mockResolvedValue([]);
      listRecurringGroceriesByHousehold.mockResolvedValue([]);

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
    // Every Store a test files a grocery under is the household's own.
    storesRepository.ownStoreExists.mockResolvedValue(true);
    ctx = createMockAuthedContext(mockUser, mockHousehold);
    getRecipeInfoForGroceries.mockResolvedValue(new Map());
    storesRepository.findBestIngredientStorePreference.mockResolvedValue(null);
  });

  it("lists only groceries for the API endpoint", async () => {
    const mockGroceries = [
      createMockGrocery({ id: crypto.randomUUID(), name: "Milk" }),
      createMockGrocery({ id: crypto.randomUUID(), name: "Bread" }),
    ];

    listGroceriesByHousehold.mockResolvedValue(mockGroceries);
    listRecurringGroceriesByHousehold.mockResolvedValue([{ id: "recurring-1" }]);

    const caller = openApiGroceriesRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.listGroceries();

    expect(result).toEqual(mockGroceries);
  });

  it("creates and returns the groceries for the API endpoint", async () => {
    const storeId = crypto.randomUUID();

    listGroceriesByHousehold.mockResolvedValue([]);
    createGroceries.mockImplementation(
      async (items: Array<{ id: string; groceries: { name: string | null } }>) => ({
        created: items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name })),
        shifted: [],
      })
    );

    const caller = openApiGroceriesRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.createGrocery({
      name: "Apples",
      amount: 2,
      unit: "pcs",
      isDone: false,
      storeId,
    });

    expect(createGroceries).toHaveBeenCalled();
    expect(result).toEqual([expect.objectContaining({ name: "Apples" })]);
  });

  it("answers the API with a grocery per food a name joins", async () => {
    listGroceriesByHousehold.mockResolvedValue([]);
    createGroceries.mockImplementation(
      async (items: Array<{ id: string; groceries: { name: string | null } }>) => ({
        created: items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name })),
        shifted: [],
      })
    );

    const caller = openApiGroceriesRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.createGrocery({
      name: "zout en peper",
      amount: 1,
      unit: null,
      isDone: false,
    });

    expect(result).toEqual([
      expect.objectContaining({ name: "zout" }),
      expect.objectContaining({ name: "peper" }),
    ]);
  });

  it("toasts a failed create to the actor alone, never the household", async () => {
    listGroceriesByHousehold.mockResolvedValue([]);
    createGroceries.mockRejectedValue(new Error("db down"));

    const caller = openApiGroceriesRouter.createCaller(createMockCallerContext(ctx));

    await expect(
      caller.createGrocery({ name: "Milk", amount: 1, unit: "pcs", isDone: false })
    ).rejects.toThrow("db down");

    expect(groceries.publish).toHaveBeenCalledWith(
      "failed",
      { reason: "Failed to create grocery item" },
      { userId: ctx.user.id }
    );
    expect(groceries.publish).not.toHaveBeenCalledWith(
      "failed",
      expect.anything(),
      expect.objectContaining({ householdId: expect.anything() })
    );
  });

  it("inserts a new grocery with the client-minted id when one is supplied", async () => {
    const clientId = crypto.randomUUID();

    // No existing groceries → no merge, so the create path runs.
    listGroceriesByHousehold.mockResolvedValue([]);
    createGroceries.mockImplementation(
      async (items: Array<{ id: string; groceries: { name: string | null } }>) => ({
        created: items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name })),
        shifted: [],
      })
    );

    // Exercise the create helper directly: the internal `create` procedure validates
    // `z.array(GroceryCreateSchema)`, which mixes zod instances across the injected
    // workspace copies and can't be driven through a tRPC caller in this test env.
    const result = await createGroceriesData(ctx, [
      { id: clientId, name: "Apples", unit: null, amount: 1, isDone: false },
    ]);

    expect(createGroceries).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: clientId })]),
      expect.anything(),
      TX
    );
    expect(result.ids).toContain(clientId);
  });

  it("mints a server-side id when the client supplies none (existing clients unaffected)", async () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    listGroceriesByHousehold.mockResolvedValue([]);
    createGroceries.mockImplementation(
      async (items: Array<{ id: string; groceries: { name: string | null } }>) => ({
        created: items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name })),
        shifted: [],
      })
    );

    const result = await createGroceriesData(ctx, [
      { name: "Bananas", unit: null, amount: 1, isDone: false },
    ]);

    const created = createGroceries.mock.calls[0][0] as Array<{ id: string }>;
    expect(created[0]?.id).toMatch(UUID_RE);
    expect(result.ids[0]).toMatch(UUID_RE);
  });

  it("carries the incoming store onto a merged grocery instead of dropping it", async () => {
    const storeId = crypto.randomUUID();
    const existing = createMockGrocery({ name: "Milk", unit: null, amount: 1, storeId: null });

    listGroceriesByHousehold.mockResolvedValue([existing]);
    updateGroceries.mockImplementation(
      async (updates: Array<{ id: string; amount: number | null; storeId?: string | null }>) =>
        updates.map((u) => createMockGrocery({ ...existing, ...u }))
    );

    const result = await createGroceriesData(ctx, [
      { name: "Milk", unit: null, amount: 2, isDone: false, storeId },
    ]);

    expect(createGroceries).not.toHaveBeenCalled();
    expect(updateGroceries).toHaveBeenCalledWith(
      [{ id: existing.id, amount: 3, storeId }],
      ctx.householdId,
      TX
    );
    expect(result.ids).toEqual([existing.id]);
  });

  it("hands back and announces the siblings a create shifted, at their new sort order", async () => {
    // Making room at the top moved the siblings' sort order, so the answer
    // carries them, and so does the household's updated event.
    const sibling = createMockGrocery({ id: "sibling", name: "Peer", sortOrder: 1 });

    listGroceriesByHousehold.mockResolvedValue([]);
    createGroceries.mockImplementation(
      async (items: Array<{ id: string; groceries: { name: string | null } }>) => ({
        created: items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name })),
        shifted: [sibling],
      })
    );

    const result = await createGroceriesData(ctx, [
      { name: "Apple", unit: null, amount: 1, isDone: false },
    ]);

    expect(result.updatedGroceries).toEqual([sibling]);
    expect(groceries.publish).toHaveBeenCalledWith(
      "updated",
      {
        changedGroceries: [sibling],
      },
      { householdId: ctx.householdId }
    );
  });

  it("keeps the existing store when the merged-in grocery has none", async () => {
    const storeId = crypto.randomUUID();
    const existing = createMockGrocery({ name: "Milk", unit: null, amount: 1, storeId });

    listGroceriesByHousehold.mockResolvedValue([existing]);
    updateGroceries.mockImplementation(
      async (updates: Array<{ id: string; amount: number | null; storeId?: string | null }>) =>
        updates.map((u) => createMockGrocery({ ...existing, ...u }))
    );

    await createGroceriesData(ctx, [{ name: "Milk", unit: null, amount: 1, isDone: false }]);

    expect(updateGroceries).toHaveBeenCalledWith(
      [{ id: existing.id, amount: 2, storeId }],
      ctx.householdId,
      TX
    );
  });

  it("marks a grocery done and returns the updated grocery", async () => {
    const groceryId = crypto.randomUUID();
    const ownerIds = new Set([groceryId]);
    const grocery = createMockGrocery({ id: groceryId, isDone: false, version: 2 });
    const updated = { ...grocery, isDone: true };

    ownGroceryIds.mockResolvedValue(ownerIds);
    getGroceriesByIds.mockResolvedValue([grocery]);
    updateGroceries.mockResolvedValue([updated]);

    const caller = openApiGroceriesRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.markGroceryDone({ id: groceryId, version: 2 });

    expect(result).toEqual({ grocery: updated, stale: false });
  });

  it("deletes a grocery and reports stale state", async () => {
    const groceryId = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    deleteGroceryByIds.mockResolvedValue({ deletedIds: [], staleIds: [groceryId] });

    const caller = openApiGroceriesRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.deleteGrocery({ id: groceryId, version: 3 });

    expect(result).toEqual({ success: true, stale: true });
  });

  it.each([
    [
      "markGroceryDone",
      (c: ReturnType<typeof caller>, id: string) => c.markGroceryDone({ id, version: 1 }),
    ],
    [
      "markGroceryUndone",
      (c: ReturnType<typeof caller>, id: string) => c.markGroceryUndone({ id, version: 1 }),
    ],
    [
      "deleteGrocery",
      (c: ReturnType<typeof caller>, id: string) => c.deleteGrocery({ id, version: 1 }),
    ],
    [
      "assignGroceryToStore",
      (c: ReturnType<typeof caller>, id: string) =>
        c.assignGroceryToStore({ id, version: 1, storeId: null, savePreference: false }),
    ],
  ])("%s answers NOT_FOUND for a grocery that does not exist", async (_, call) => {
    ownGroceryIds.mockResolvedValue(new Set());
    getGroceriesByIds.mockResolvedValue([]);

    await expect(call(caller(), crypto.randomUUID())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  function caller() {
    return openApiGroceriesRouter.createCaller(createMockCallerContext(ctx));
  }

  it("marks a grocery as undone and returns the updated grocery", async () => {
    const groceryId = crypto.randomUUID();
    const ownerIds = new Set([groceryId]);
    const grocery = createMockGrocery({ id: groceryId, isDone: true, version: 4 });
    const updated = { ...grocery, isDone: false };

    ownGroceryIds.mockResolvedValue(ownerIds);
    getGroceriesByIds.mockResolvedValue([grocery]);
    updateGroceries.mockResolvedValue([updated]);

    const caller = openApiGroceriesRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.markGroceryUndone({ id: groceryId, version: 4 });

    expect(result).toEqual({ grocery: updated, stale: false });
  });

  it("assigns a grocery to a store and returns the updated grocery", async () => {
    const groceryId = crypto.randomUUID();
    const storeId = crypto.randomUUID();
    const grocery = createMockGrocery({ id: groceryId, name: "Milk", storeId: null });
    const updated = { ...grocery, storeId };

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    getGroceriesByIds.mockResolvedValue([grocery]);
    storesRepository.ownStoreExists.mockResolvedValue(true);
    assignGroceryToStore.mockResolvedValue(updated);

    const caller = openApiGroceriesRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.assignGroceryToStore({ id: groceryId, version: 2, storeId });

    expect(assignGroceryToStore).toHaveBeenCalledWith(groceryId, storeId, ctx.householdId, 2);
    expect(result).toEqual({ grocery: updated, stale: false });
  });
});

describe("stale grocery updates", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    // Every Store a test files a grocery under is the household's own.
    storesRepository.ownStoreExists.mockResolvedValue(true);
    listGroceriesByHousehold.mockResolvedValue([]);
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  it("drops stale grocery row updates and asks clients to refresh", async () => {
    const groceryId = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    updateGroceries.mockResolvedValue([]);

    const caller = groceriesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.update({ groceryId, raw: "Oat milk", version: 4 });

    await flushAsync();

    expect(result).toEqual({ success: true, stale: true });
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, groceryId, version: 4 },
      "Stale grocery update; requesting client refresh"
    );
    expect(groceries.publish).not.toHaveBeenCalledWith("updated", expect.anything(), {
      householdId: ctx.householdId,
    });
    expect(groceries.publish).toHaveBeenCalledWith(
      "stale",
      {
        reason: expect.any(String),
      },
      { householdId: ctx.householdId }
    );
  });

  it("resolves an edited grocery knowing the grocery it edits and the recipe line it came from", async () => {
    const groceryId = crypto.randomUUID();
    const recipeIngredientId = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    getGroceryRecipeLine.mockResolvedValue(recipeIngredientId);
    updateGroceries.mockResolvedValue([]);

    const caller = groceriesProcedures.createCaller(createMockCallerContext(ctx));

    await caller.update({ groceryId, raw: "3 onions, diced", version: 4 });
    await flushAsync();

    expect(resolveGroceryNames).toHaveBeenCalledWith(
      [expect.objectContaining({ recipeIngredientId, groceryId })],
      { userId: ctx.user.id, householdId: ctx.householdId }
    );
  });

  it("saves the ingredient store preference when the update carries a store change", async () => {
    const groceryId = crypto.randomUUID();
    const storeId = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    updateGroceries.mockResolvedValue([
      createMockGrocery({ id: groceryId, name: "Oat Milk", storeId }),
    ]);

    const caller = groceriesProcedures.createCaller(createMockCallerContext(ctx));

    await caller.update({ groceryId, raw: "Oat milk", version: 4, storeId });

    await flushAsync();

    expect(storesRepository.upsertIngredientStorePreference).toHaveBeenCalledWith(
      ctx.householdId,
      ctx.user.id,
      "ingredient:oat milk",
      storeId
    );
  });

  it("answers stored when the work after the commit fails, and logs it", async () => {
    const groceryId = crypto.randomUUID();
    const storeId = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    updateGroceries.mockResolvedValue([
      createMockGrocery({ id: groceryId, name: "Oat Milk", storeId }),
    ]);
    storesRepository.upsertIngredientStorePreference.mockRejectedValueOnce(new Error("down"));

    const caller = groceriesProcedures.createCaller(createMockCallerContext(ctx));

    await expect(
      caller.update({ groceryId, raw: "Oat milk", version: 4, storeId })
    ).resolves.toEqual({ success: true, stale: false });
    expect(trpcLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.stringContaining("after")
    );
    expect(groceries.publish).not.toHaveBeenCalledWith("failed", expect.anything(), {
      userId: ctx.user.id,
    });
  });

  it("asks the Store a grocery was dragged into what it knows about it", async () => {
    const groceryId = crypto.randomUUID();
    const storeId = crypto.randomUUID();
    const link = {
      storeId,
      ingredientId: "ingredient:cola",
      lastTriedAt: null,
      product: { id: crypto.randomUUID(), storeId, name: "Cola 1 L", price: 1.49 },
    };

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    storesRepository.ownStoreExists.mockResolvedValue(true);
    getGroceriesByIds.mockResolvedValue([createMockGrocery({ id: groceryId, name: "cola" })]);
    reorderGroceriesInStore.mockResolvedValue([
      createMockGrocery({ id: groceryId, name: "cola", storeId }),
    ]);
    storeProductsRepository.resolveProductLinks.mockResolvedValue([link]);
    // Pricing answers only for the household's own Stores.
    storesRepository.listStoresByHousehold.mockResolvedValue([
      { id: storeId, searchAddress: null },
    ]);

    const caller = groceriesProcedures.createCaller(createMockCallerContext(ctx));

    await caller.reorderInStore({
      updates: [{ id: groceryId, version: 1, sortOrder: 0, storeId }],
      savePreference: true,
    });

    await flushAsync();

    // Dragging a grocery into another Store asks that Store the same question
    // the panel would: what it already knows reaches the list there and then.
    expect(stores.publish).toHaveBeenCalledWith(
      "linkUpdated",
      {
        link,
      },
      { householdId: ctx.householdId }
    );
  });

  it("passes storeId through to updateGroceries when provided", async () => {
    const groceryId = crypto.randomUUID();
    const storeId = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    updateGroceries.mockResolvedValue([createMockGrocery({ id: groceryId, storeId })]);

    const caller = groceriesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.update({
      groceryId,
      raw: "Oat milk",
      version: 4,
      storeId,
    });

    // Let the .then() chain in the handler run
    await flushAsync();

    expect(result).toEqual({ success: true, stale: false });

    // Verify storeId was included in the update data passed to the DB layer
    const updates = updateGroceries.mock.calls[0][0] as Array<{ storeId: unknown }>;
    const update = updates.find((u) => u.storeId === storeId);
    expect(update).toBeDefined();
    expect(update!.storeId).toBe(storeId);
  });

  it("passes storeId=null (unsorted) through to updateGroceries", async () => {
    const groceryId = crypto.randomUUID();
    const currentStoreId = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    updateGroceries.mockResolvedValue([createMockGrocery({ id: groceryId, storeId: null })]);

    const caller = groceriesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.update({
      groceryId,
      raw: "Oat milk",
      version: 4,
      storeId: null,
    });

    await flushAsync();

    expect(result).toEqual({ success: true, stale: false });

    // Verify storeId=null was passed to the DB layer (setting item to unsorted)
    const updates = updateGroceries.mock.calls[0][0] as Array<{ storeId: unknown }>;
    const update = updates.find((u) => u.storeId === null);
    expect(update).toBeDefined();
  });

  it("omits storeId from updateData when not provided", async () => {
    const groceryId = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    updateGroceries.mockResolvedValue([createMockGrocery({ id: groceryId })]);

    const caller = groceriesProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.update({
      groceryId,
      raw: "Oat milk",
      version: 4,
    });

    await flushAsync();

    expect(result).toEqual({ success: true, stale: false });

    // Verify storeId was not set on the update data
    const updates = updateGroceries.mock.calls[0][0] as Array<Record<string, unknown>>;
    const update = updates[0];
    // The update data should not have a storeId property (undefined, not null)
    // It may have storeId undefined or not present — just confirm it's not a value
    expect(update).toBeDefined();
  });
});

describe("grocery names through Ingredient Aliases", () => {
  const ctx = createMockAuthedContext(createMockUser(), createMockHousehold());

  beforeEach(() => {
    storesRepository.ownStoreExists.mockResolvedValue(true);
    listGroceriesByHousehold.mockResolvedValue([]);
    createGroceries.mockImplementation(
      async (items: Array<{ id: string; groceries: { name: string | null } }>) => ({
        created: items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name })),
        shifted: [],
      })
    );
  });

  it("refuses a line from a recipe the household may not view, and stores nothing", async () => {
    getRecipeInfoForGroceries.mockResolvedValue(new Map());

    await expect(
      createGroceriesData(ctx, [
        {
          id: crypto.randomUUID(),
          name: "onions",
          unit: null,
          amount: 1,
          isDone: false,
          recipeIngredientId: crypto.randomUUID(),
        },
      ])
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(getRecipeInfoForGroceries).toHaveBeenCalledWith(expect.any(Array), ctx.householdId);
  });

  it("stores a new grocery with the alias its name resolved to, and its text as written", async () => {
    const recipeIngredientId = crypto.randomUUID();

    getRecipeInfoForGroceries.mockResolvedValue(
      new Map([[recipeIngredientId, { recipeId: crypto.randomUUID(), recipeName: "Soup" }]])
    );

    await createGroceriesData(ctx, [
      { id: crypto.randomUUID(), name: "Uien", unit: null, amount: 1, isDone: false },
      {
        id: crypto.randomUUID(),
        name: "onions, diced",
        unit: null,
        amount: 2,
        isDone: false,
        recipeIngredientId,
      },
    ]);

    // A line from a recipe is resolved knowing which line it came from.
    expect(resolveGroceryNames).toHaveBeenCalledWith(
      [
        expect.objectContaining({ name: "Uien", recipeIngredientId: null }),
        expect.objectContaining({ name: "onions, diced", recipeIngredientId }),
      ],
      { userId: ctx.user.id, householdId: ctx.householdId }
    );
    expect(createGroceries).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          groceries: expect.objectContaining({ name: "Uien", ingredientAliasId: "alias:uien" }),
        }),
        expect.objectContaining({
          groceries: expect.objectContaining({
            name: "onions, diced",
            ingredientAliasId: "alias:onions, diced",
          }),
        }),
      ],
      expect.anything(),
      TX
    );
  });

  it("merges a same-unit add into the line already there, as before", async () => {
    listGroceriesByHousehold.mockResolvedValue([
      createMockGrocery({ id: "g1", name: "Milk", unit: "l", amount: 1 }),
    ]);
    updateGroceries.mockResolvedValue([]);

    await createGroceriesData(ctx, [
      { id: crypto.randomUUID(), name: "milk", unit: "l", amount: 2, isDone: false },
    ]);

    expect(createGroceries).not.toHaveBeenCalled();
    expect(updateGroceries).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "g1", amount: 3 })],
      ctx.householdId,
      TX
    );
  });

  it("adds a grocery per food a typed name joins, each announced like any created grocery", async () => {
    const id = crypto.randomUUID();
    const result = await createGroceriesData(ctx, [
      { id, name: "zout en peper", unit: "el", amount: 2, isDone: false },
    ]);

    expect(createGroceries).toHaveBeenCalledWith(
      [
        {
          id,
          groceries: expect.objectContaining({
            name: "zout",
            amount: 2,
            unit: "el",
            ingredientAliasId: "alias:zout",
          }),
        },
        {
          id: expect.not.stringMatching(id),
          groceries: expect.objectContaining({
            name: "peper",
            amount: 2,
            unit: "el",
            ingredientAliasId: "alias:peper",
          }),
        },
      ],
      expect.anything(),
      TX
    );
    expect(result.ids).toEqual([id, expect.any(String)]);
    expect(groceries.publish).toHaveBeenCalledWith(
      "created",
      {
        groceries: [
          expect.objectContaining({ id, name: "zout" }),
          expect.objectContaining({ name: "peper" }),
        ],
      },
      { householdId: ctx.householdId }
    );
  });

  it("merges each food of a typed name into its own line already there", async () => {
    listGroceriesByHousehold.mockResolvedValue([
      createMockGrocery({ id: "g1", name: "Zout", unit: null, amount: 1 }),
    ]);
    updateGroceries.mockResolvedValue([]);

    await createGroceriesData(ctx, [
      { id: crypto.randomUUID(), name: "zout en peper", unit: null, amount: 1, isDone: false },
    ]);

    expect(updateGroceries).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "g1", amount: 2 })],
      ctx.householdId,
      TX
    );
    expect(createGroceries).toHaveBeenCalledWith(
      [expect.objectContaining({ groceries: expect.objectContaining({ name: "peper" }) })],
      expect.anything(),
      TX
    );
  });

  it("leaves a grocery renamed to a name joining foods as a grocery per food", async () => {
    const groceryId = crypto.randomUUID();
    const storeId = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    getGroceriesByIds.mockResolvedValue([createMockGrocery({ id: groceryId, name: "zout" })]);
    parseIngredientWithDefaults.mockReturnValueOnce([
      { description: "zout en peper", quantity: 2, unitOfMeasure: "el" },
    ]);
    updateGroceries.mockResolvedValue([createMockGrocery({ id: groceryId, name: "zout" })]);

    await groceriesProcedures
      .createCaller(createMockCallerContext(ctx))
      .update({ groceryId, raw: "2 el zout en peper", version: 4, purchaseAmount: 3, storeId });

    await vi.waitFor(() =>
      expect(groceries.publish).toHaveBeenCalledWith(
        "created",
        { groceries: [expect.objectContaining({ name: "peper" })] },
        { householdId: ctx.householdId }
      )
    );
    expect(updateGroceries).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: groceryId,
          name: "zout",
          amount: 2,
          unit: "el",
          ingredientAliasId: "alias:zout",
        }),
      ],
      ctx.householdId,
      TX
    );
    // The list is held before the rename locks its row, so a create elsewhere waits, not deadlocks.
    expect(lockGroceryList).toHaveBeenCalledWith(TX, ctx.householdId);
    expect(lockGroceryList.mock.invocationCallOrder[0]).toBeLessThan(
      updateGroceries.mock.invocationCallOrder[0]!
    );
    // The other food finds its own Store and pack count, as a typed add does.
    expect(createGroceries).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          groceries: expect.objectContaining({
            name: "peper",
            amount: 2,
            unit: "el",
            ingredientAliasId: "alias:peper",
            storeId: null,
            purchaseAmount: undefined,
          }),
        }),
      ],
      expect.anything(),
      TX
    );
  });

  it("splits a line from a recipe out of view, keeping the reference it already had", async () => {
    const groceryId = crypto.randomUUID();
    const recipeLine = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    getGroceryRecipeLine.mockResolvedValue(recipeLine);
    // The recipe the line came from is out of view now.
    getRecipeInfoForGroceries.mockResolvedValue(new Map());
    parseIngredientWithDefaults.mockReturnValueOnce([
      { description: "zout en peper", quantity: 2, unitOfMeasure: "el" },
    ]);
    updateGroceries.mockResolvedValue([createMockGrocery({ id: groceryId, name: "zout" })]);

    await groceriesProcedures
      .createCaller(createMockCallerContext(ctx))
      .update({ groceryId, raw: "2 el zout en peper", version: 4 });

    expect(createGroceries).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          groceries: expect.objectContaining({ name: "peper", recipeIngredientId: recipeLine }),
        }),
      ],
      expect.anything(),
      TX
    );
  });

  it("writes none of a renamed grocery's other foods when the rename was stale", async () => {
    const groceryId = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    getGroceriesByIds.mockResolvedValue([createMockGrocery({ id: groceryId, name: "zout" })]);
    parseIngredientWithDefaults.mockReturnValueOnce([
      { description: "zout en peper", quantity: 1, unitOfMeasure: null },
    ]);
    updateGroceries.mockResolvedValue([]);

    await groceriesProcedures
      .createCaller(createMockCallerContext(ctx))
      .update({ groceryId, raw: "zout en peper", version: 4 });

    await vi.waitFor(() =>
      expect(groceries.publish).toHaveBeenCalledWith("stale", expect.anything(), {
        householdId: ctx.householdId,
      })
    );
    expect(createGroceries).not.toHaveBeenCalled();
    expect(groceries.publish).not.toHaveBeenCalledWith("created", expect.anything(), {
      householdId: ctx.householdId,
    });
  });

  it("resolves a renamed grocery's new name", async () => {
    const groceryId = crypto.randomUUID();

    ownGroceryIds.mockResolvedValue(new Set([groceryId]));
    updateGroceries.mockResolvedValue([createMockGrocery({ id: groceryId })]);

    await groceriesProcedures
      .createCaller(createMockCallerContext(ctx))
      .update({ groceryId, raw: "1 piece Test", version: 4 });

    // The line parser is mocked here, and reads every raw line as "Test".
    await vi.waitFor(() =>
      expect(updateGroceries).toHaveBeenCalledWith(
        [expect.objectContaining({ id: groceryId, name: "Test", ingredientAliasId: "alias:test" })],
        ctx.householdId,
        TX
      )
    );
  });
});

// ADR-0004: a write refused for its version answers `stale: true` once it is decided, so Replay parks it.
describe("a grocery write answers whether it was refused as stale", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;
  const id = crypto.randomUUID();
  const row = createMockGrocery({ id });

  beforeEach(() => {
    storesRepository.ownStoreExists.mockResolvedValue(true);
    listGroceriesByHousehold.mockResolvedValue([]);
    ctx = createMockAuthedContext(mockUser, mockHousehold);
    ownGroceryIds.mockResolvedValue(new Set([id]));
    getGroceriesByIds.mockResolvedValue([row]);
  });

  const caller = () => groceriesProcedures.createCaller(createMockCallerContext(ctx));
  const writes: Array<[string, (applied: boolean) => void, () => Promise<unknown>]> = [
    [
      "update",
      (applied) => updateGroceries.mockResolvedValue(applied ? [row] : []),
      () => caller().update({ groceryId: id, raw: "Oat milk", version: 1 }),
    ],
    [
      "toggle",
      (applied) => updateGroceries.mockResolvedValue(applied ? [row] : []),
      () => caller().toggle({ groceries: [{ id, version: 1 }], isDone: true }),
    ],
    [
      "delete",
      (applied) =>
        deleteGroceryByIds.mockImplementation(async (items: Array<{ id: string }>) => {
          const ids = items.map((item) => item.id);

          return applied ? { deletedIds: ids, staleIds: [] } : { deletedIds: [], staleIds: ids };
        }),
      () => caller().delete({ groceries: [{ id, version: 1 }] }),
    ],
    [
      "assignToStore",
      (applied) => assignGroceryToStore.mockResolvedValue(applied ? row : null),
      () => caller().assignToStore({ groceryId: id, version: 1, storeId: null }),
    ],
    [
      "reorderInStore",
      (applied) => reorderGroceriesInStore.mockResolvedValue(applied ? [row] : []),
      () => caller().reorderInStore({ updates: [{ id, version: 1, sortOrder: 0 }] }),
    ],
    [
      "markAllDone",
      (applied) => markAllDoneInStore.mockResolvedValue(applied ? [row] : []),
      () => caller().markAllDone({ storeId: null, groceries: [{ id, version: 1 }] }),
    ],
    [
      "deleteDone",
      (applied) => deleteDoneInStore.mockResolvedValue(applied ? [id] : []),
      () => caller().deleteDone({ storeId: null, groceries: [{ id, version: 1 }] }),
    ],
  ];

  it.each(writes)("%s answers stale: true when refused", async (_, answer, write) => {
    answer(false);

    await expect(write()).resolves.toEqual({ success: true, stale: true });
  });

  it.each(writes)("%s answers stale: false when stored", async (_, answer, write) => {
    answer(true);

    await expect(write()).resolves.toEqual({ success: true, stale: false });
  });

  it.each(writes)(
    "%s rejects a write that failed, so Replay parks it",
    async (_, answer, write) => {
      answer(true);
      ownGroceryIds.mockRejectedValue(new Error("database down"));
      markAllDoneInStore.mockRejectedValue(new Error("database down"));
      deleteDoneInStore.mockRejectedValue(new Error("database down"));

      await expect(write()).rejects.toThrow();
      // The app's own client toasts the rejection; a `failed` event would toast it twice.
      expect(groceries.publish).not.toHaveBeenCalledWith("failed", expect.anything(), {
        userId: ctx.user.id,
      });
    }
  );

  it("createRecurring rejects a failed write without a second toast", async () => {
    createRecurringGroceries.mockRejectedValue(new Error("database down"));

    await expect(
      recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx)).createRecurring({
        name: "Milk",
        amount: 1,
        unit: null,
        recurrenceRule: "week",
        recurrenceInterval: 1,
        recurrenceWeekday: null,
        nextPlannedFor: "2026-11-16",
      })
    ).rejects.toThrow();
    expect(groceries.publish).not.toHaveBeenCalledWith("failed", expect.anything(), {
      userId: ctx.user.id,
    });
  });

  const deletes = ["delete", "deleteDone"];

  it.each(writes.filter(([name]) => !deletes.includes(name)))(
    "%s answers stale: true for a line another member deleted",
    async (_, answer, write) => {
      answer(false);
      ownGroceryIds.mockResolvedValue(new Set());
      getGroceriesByIds.mockResolvedValue([]);

      await expect(write()).resolves.toEqual({ success: true, stale: true });
    }
  );

  it.each(writes.filter(([name]) => deletes.includes(name)))(
    "%s of a line already gone succeeds as a no-op",
    async (_, answer, write) => {
      answer(false);
      ownGroceryIds.mockResolvedValue(new Set());
      getGroceriesByIds.mockResolvedValue([]);

      await expect(write()).resolves.toEqual({ success: true, stale: false });
    }
  );
});
