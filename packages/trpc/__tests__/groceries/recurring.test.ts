// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recurringGroceriesProcedures } from "@norish/trpc/routers/groceries/recurring";

// Import test utilities
import { createMockCallerContext } from "../calendar/test-utils";
import { createGrocery } from "../mocks/db";
import { groceryEmitter } from "../mocks/grocery-emitter";
import { assertHouseholdAccess } from "../mocks/permissions";
import { calculateNextOccurrence } from "../mocks/recurrence";
// Import mocks for assertions
import {
  checkRecurringGrocery,
  createRecurringGrocery,
  deleteRecurringGroceryById,
  detachRecurringGrocery,
  getRecurringGroceryById,
  getRecurringGroceryOwnerId,
  updateRecurringGrocery,
  updateRecurringGroceryWithGrocery,
} from "../mocks/recurring-groceries";
import {
  createMockAuthedContext,
  createMockGrocery,
  createMockHousehold,
  createMockRecurringGrocery,
  createMockUser,
} from "./test-utils";

const storesRepository = vi.hoisted(() => ({
  findBestIngredientStorePreference: vi.fn(),
  getStoreOwnerId: vi.fn(),
  normalizeIngredientName: vi.fn((name: string) => name.toLowerCase()),
  upsertIngredientStorePreference: vi.fn(),
  // A household with no Store that points at a shop: pricing notices the
  // groceries, finds nothing to ask, and visits nothing.
  listStoresByUserIds: vi.fn(async () => []),
}));

const storeProductsRepository = vi.hoisted(() => ({
  resolveProductLinks: vi.fn(async () => [] as unknown[]),
  listStaleProducts: vi.fn(async () => []),
}));

const storeEmitter = vi.hoisted(() => ({ emitToHousehold: vi.fn() }));

// Setup mocks
vi.mock("@norish/db", () => import("../mocks/db"));
vi.mock("@norish/db/repositories/stores", () => storesRepository);
vi.mock("@norish/db/repositories/store-products", () => storeProductsRepository);
vi.mock("@norish/shared-server/realtime/stores", () => ({ storeEmitter }));
vi.mock(
  "@norish/db/repositories/recurring-groceries",
  () => import("../mocks/recurring-groceries")
);
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/groceries/emitter", () => import("../mocks/grocery-emitter"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));
vi.mock("@norish/shared/lib/helpers", () => import("../mocks/helpers"));
vi.mock("@norish/shared/lib/recurrence/calculator", () => import("../mocks/recurrence"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// The recurring procedures return { success: true } before their DB work runs;
// yield a macrotask so the fire-and-forget promise chain settles.
const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("recurring groceries procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
    getRecurringGroceryOwnerId.mockResolvedValue(ctx.user.id);
    assertHouseholdAccess.mockResolvedValue(undefined);
  });

  describe("createRecurring", () => {
    it("creates recurring grocery and initial grocery item", async () => {
      const recurringData = {
        name: "Weekly Milk",
        amount: 2,
        unit: "liters",
        recurrenceRule: "week" as const,
        recurrenceInterval: 1,
        recurrenceWeekday: null,
        nextPlannedFor: "2025-12-01",
      };

      const mockRecurring = createMockRecurringGrocery({
        id: "recurring-1",
        ...recurringData,
      });

      createRecurringGrocery.mockResolvedValue(mockRecurring);

      const created = await createRecurringGrocery({
        userId: ctx.user.id,
        ...recurringData,
        lastCheckedDate: null,
      });

      expect(createRecurringGrocery).toHaveBeenCalled();
      expect(created.name).toBe("Weekly Milk");
      expect(created.recurrenceRule).toBe("week");
    });

    it("emits recurringCreated event after success", () => {
      const mockRecurring = createMockRecurringGrocery({ id: "r1" });
      const mockGrocery = createMockGrocery({ id: "g1", recurringGroceryId: "r1" });

      groceryEmitter.emitToHousehold(ctx.householdKey, "recurringCreated", {
        recurringGrocery: mockRecurring,
        grocery: mockGrocery,
      });

      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringCreated",
        expect.objectContaining({
          recurringGrocery: mockRecurring,
          grocery: mockGrocery,
        })
      );
    });

    it("inserts the recurring row with the client-minted id when one is supplied", async () => {
      const clientId = crypto.randomUUID();

      createRecurringGrocery.mockResolvedValue(
        createMockRecurringGrocery({ id: clientId, name: "Weekly Milk" })
      );
      createGrocery.mockResolvedValue({
        created: createMockGrocery({ id: crypto.randomUUID() }),
        shifted: [],
      });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      await caller.createRecurring({
        id: clientId,
        name: "Weekly Milk",
        amount: 2,
        unit: "liters",
        recurrenceRule: "week",
        recurrenceInterval: 1,
        recurrenceWeekday: null,
        nextPlannedFor: "2025-12-01",
      });

      expect(createRecurringGrocery).toHaveBeenCalledWith(
        expect.objectContaining({ id: clientId })
      );
    });
  });

  describe("updateRecurring", () => {
    it("updates recurring grocery and linked grocery item", async () => {
      const mockRecurring = createMockRecurringGrocery({
        id: "r1",
        name: "Updated Name",
      });

      updateRecurringGrocery.mockResolvedValue(mockRecurring);

      const updated = await updateRecurringGrocery({
        id: "r1",
        name: "Updated Name",
      });

      expect(updateRecurringGrocery).toHaveBeenCalledWith({
        id: "r1",
        name: "Updated Name",
      });
      expect(updated.name).toBe("Updated Name");
    });

    it("emits recurringUpdated event after success", () => {
      const mockRecurring = createMockRecurringGrocery({ id: "r1" });
      const mockGrocery = createMockGrocery({ id: "g1" });

      groceryEmitter.emitToHousehold(ctx.householdKey, "recurringUpdated", {
        recurringGrocery: mockRecurring,
        grocery: mockGrocery,
      });

      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringUpdated",
        expect.objectContaining({
          recurringGrocery: mockRecurring,
          grocery: mockGrocery,
        })
      );
    });
  });

  describe("deleteRecurring", () => {
    it("deletes recurring grocery by id", async () => {
      deleteRecurringGroceryById.mockResolvedValue(undefined);

      await deleteRecurringGroceryById("r1");

      expect(deleteRecurringGroceryById).toHaveBeenCalledWith("r1");
    });

    it("emits recurringDeleted event after success", () => {
      const recurringGroceryId = "r1";

      groceryEmitter.emitToHousehold(ctx.householdKey, "recurringDeleted", {
        recurringGroceryId,
      });

      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringDeleted",
        { recurringGroceryId }
      );
    });

    it("deletes linked groceries in the same transaction and emits both events", async () => {
      deleteRecurringGroceryById.mockResolvedValue({
        stale: false,
        deletedGroceryIds: ["g1", "g2"],
      });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      const result = await caller.deleteRecurring({
        recurringGroceryId: "r1",
        version: 4,
      });

      await flushAsync();

      expect(result).toEqual({ success: true });
      expect(deleteRecurringGroceryById).toHaveBeenCalledWith("r1", 4);
      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "deleted", {
        groceryIds: ["g1", "g2"],
      });
      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringDeleted",
        { recurringGroceryId: "r1" }
      );
    });

    it("emits a stale event instead of data events for stale recurring deletes", async () => {
      deleteRecurringGroceryById.mockResolvedValue({ stale: true, deletedGroceryIds: [] });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      const result = await caller.deleteRecurring({
        recurringGroceryId: "r1",
        version: 4,
      });

      expect(result).toEqual({ success: true });
      await flushAsync();

      expect(deleteRecurringGroceryById).toHaveBeenCalledWith("r1", 4);
      expect(groceryEmitter.emitToHousehold).not.toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringDeleted",
        expect.anything()
      );
      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "stale", {
        reason: expect.any(String),
      });
    });
  });

  describe("updateRecurring procedure", () => {
    it("updates both rows through the transactional repo call and emits recurringUpdated", async () => {
      const mockRecurring = createMockRecurringGrocery({ id: "r1", name: "Oat milk" });
      const mockGrocery = createMockGrocery({ id: "g1", name: "Oat milk" });

      updateRecurringGroceryWithGrocery.mockResolvedValue({
        applied: true,
        stale: false,
        value: { recurringGrocery: mockRecurring, grocery: mockGrocery },
      });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      const result = await caller.updateRecurring({
        recurringGroceryId: "r1",
        recurringVersion: 2,
        groceryId: "g1",
        groceryVersion: 3,
        data: { name: "Oat milk" },
      });

      await flushAsync();

      expect(result).toEqual({ success: true });
      expect(updateRecurringGroceryWithGrocery).toHaveBeenCalledWith(
        { id: "r1", version: 2, name: "Oat milk" },
        { id: "g1", version: 3, storeId: undefined }
      );
      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringUpdated",
        { recurringGrocery: mockRecurring, grocery: mockGrocery }
      );
    });

    it("saves the ingredient store preference when a store change rides along", async () => {
      const storeId = crypto.randomUUID();
      const mockRecurring = createMockRecurringGrocery({ id: "r1", name: "Oat Milk" });
      const mockGrocery = createMockGrocery({ id: "g1", name: "Oat Milk", storeId });

      updateRecurringGroceryWithGrocery.mockResolvedValue({
        applied: true,
        stale: false,
        value: { recurringGrocery: mockRecurring, grocery: mockGrocery },
      });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      await caller.updateRecurring({
        recurringGroceryId: "r1",
        recurringVersion: 2,
        groceryId: "g1",
        groceryVersion: 3,
        storeId,
        data: { name: "Oat Milk" },
      });

      await flushAsync();

      expect(updateRecurringGroceryWithGrocery).toHaveBeenCalledWith(
        { id: "r1", version: 2, name: "Oat Milk" },
        { id: "g1", version: 3, storeId }
      );
      expect(storesRepository.upsertIngredientStorePreference).toHaveBeenCalledWith(
        ctx.user.id,
        "oat milk",
        storeId
      );
    });

    it("emits a stale event when the transactional update loses the version race", async () => {
      updateRecurringGroceryWithGrocery.mockResolvedValue({ applied: false, stale: true });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      const result = await caller.updateRecurring({
        recurringGroceryId: "r1",
        recurringVersion: 2,
        groceryId: "g1",
        groceryVersion: 3,
        data: { name: "Oat milk" },
      });

      await flushAsync();

      expect(result).toEqual({ success: true });
      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "stale", {
        reason: expect.any(String),
      });
      expect(groceryEmitter.emitToHousehold).not.toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringUpdated",
        expect.anything()
      );
    });
  });

  describe("detachRecurring", () => {
    it("deletes the recurring row and applies the grocery edit as one mutation", async () => {
      const recurringGroceryId = crypto.randomUUID();
      const groceryId = crypto.randomUUID();
      const detached = createMockGrocery({ id: groceryId, recurringGroceryId: null });

      detachRecurringGrocery.mockResolvedValue({ applied: true, stale: false, value: detached });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      const result = await caller.detachRecurring({
        recurringGroceryId,
        recurringVersion: 2,
        groceryId,
        groceryVersion: 3,
        raw: "Oat milk",
      });

      await flushAsync();

      expect(result).toEqual({ success: true });
      // Parsed ingredient comes from the mocked parseIngredientWithDefaults
      expect(detachRecurringGrocery).toHaveBeenCalledWith({
        recurringGroceryId,
        recurringVersion: 2,
        grocery: { id: groceryId, version: 3, name: "Test", unit: "piece", amount: 1 },
      });
      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringDeleted",
        { recurringGroceryId }
      );
      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "updated", {
        changedGroceries: [detached],
      });
    });

    it("passes storeId through and saves the store preference", async () => {
      const recurringGroceryId = crypto.randomUUID();
      const groceryId = crypto.randomUUID();
      const storeId = crypto.randomUUID();
      const detached = createMockGrocery({
        id: groceryId,
        name: "Test",
        recurringGroceryId: null,
        storeId,
      });

      detachRecurringGrocery.mockResolvedValue({ applied: true, stale: false, value: detached });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      await caller.detachRecurring({
        recurringGroceryId,
        recurringVersion: 2,
        groceryId,
        groceryVersion: 3,
        raw: "Oat milk",
        storeId,
      });

      await flushAsync();

      expect(detachRecurringGrocery).toHaveBeenCalledWith({
        recurringGroceryId,
        recurringVersion: 2,
        grocery: { id: groceryId, version: 3, name: "Test", unit: "piece", amount: 1, storeId },
      });
      expect(storesRepository.upsertIngredientStorePreference).toHaveBeenCalledWith(
        ctx.user.id,
        "test",
        storeId
      );
    });

    it("emits a stale event and no data events when the detach loses the race", async () => {
      const recurringGroceryId = crypto.randomUUID();
      const groceryId = crypto.randomUUID();

      detachRecurringGrocery.mockResolvedValue({ applied: false, stale: true });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      const result = await caller.detachRecurring({
        recurringGroceryId,
        recurringVersion: 2,
        groceryId,
        groceryVersion: 3,
        raw: "Oat milk",
      });

      await flushAsync();

      expect(result).toEqual({ success: true });
      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "stale", {
        reason: expect.any(String),
      });
      expect(groceryEmitter.emitToHousehold).not.toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringDeleted",
        expect.anything()
      );
      expect(groceryEmitter.emitToHousehold).not.toHaveBeenCalledWith(
        ctx.householdKey,
        "updated",
        expect.anything()
      );
    });
  });

  describe("checkRecurring procedure", () => {
    it("toggles the grocery and advances the schedule through one transactional call", async () => {
      const mockRecurring = createMockRecurringGrocery({
        id: "r1",
        recurrenceRule: "week",
        recurrenceInterval: 1,
        nextPlannedFor: "2025-11-29",
      });
      const checkedGrocery = createMockGrocery({ id: "g1", isDone: true });
      const advancedRecurring = createMockRecurringGrocery({
        id: "r1",
        nextPlannedFor: "2025-12-06",
      });

      getRecurringGroceryById.mockResolvedValue(mockRecurring);
      calculateNextOccurrence.mockReturnValue("2025-12-06");
      checkRecurringGrocery.mockResolvedValue({
        applied: true,
        stale: false,
        value: { grocery: checkedGrocery, recurringGrocery: advancedRecurring },
      });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      const result = await caller.checkRecurring({
        recurringGroceryId: "r1",
        recurringVersion: 2,
        groceryId: "g1",
        groceryVersion: 3,
        isDone: true,
      });

      await flushAsync();

      expect(result).toEqual({ success: true });
      expect(checkRecurringGrocery).toHaveBeenCalledWith({
        groceryId: "g1",
        groceryVersion: 3,
        isDone: true,
        recurringUpdate: {
          id: "r1",
          version: 2,
          lastCheckedDate: "2025-11-29",
          nextPlannedFor: "2025-12-06",
        },
      });
      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringUpdated",
        { recurringGrocery: advancedRecurring, grocery: checkedGrocery }
      );
    });

    it("skips the recurring update when unchecking and emits the unchanged recurring", async () => {
      const mockRecurring = createMockRecurringGrocery({ id: "r1" });
      const uncheckedGrocery = createMockGrocery({ id: "g1", isDone: false });

      getRecurringGroceryById.mockResolvedValue(mockRecurring);
      checkRecurringGrocery.mockResolvedValue({
        applied: true,
        stale: false,
        value: { grocery: uncheckedGrocery, recurringGrocery: null },
      });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      await caller.checkRecurring({
        recurringGroceryId: "r1",
        recurringVersion: 2,
        groceryId: "g1",
        groceryVersion: 3,
        isDone: false,
      });

      await flushAsync();

      expect(checkRecurringGrocery).toHaveBeenCalledWith({
        groceryId: "g1",
        groceryVersion: 3,
        isDone: false,
        recurringUpdate: null,
      });
      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringUpdated",
        { recurringGrocery: mockRecurring, grocery: uncheckedGrocery }
      );
    });

    it("emits a stale event when either row loses the version race", async () => {
      const mockRecurring = createMockRecurringGrocery({ id: "r1" });

      getRecurringGroceryById.mockResolvedValue(mockRecurring);
      calculateNextOccurrence.mockReturnValue("2025-12-06");
      checkRecurringGrocery.mockResolvedValue({ applied: false, stale: true });

      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      const result = await caller.checkRecurring({
        recurringGroceryId: "r1",
        recurringVersion: 2,
        groceryId: "g1",
        groceryVersion: 3,
        isDone: true,
      });

      await flushAsync();

      expect(result).toEqual({ success: true });
      expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "stale", {
        reason: expect.any(String),
      });
      expect(groceryEmitter.emitToHousehold).not.toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringUpdated",
        expect.anything()
      );
    });
  });

  describe("checkRecurring", () => {
    it("calculates next occurrence when marked as done", async () => {
      const mockRecurring = createMockRecurringGrocery({
        id: "r1",
        recurrenceRule: "week",
        recurrenceInterval: 1,
        nextPlannedFor: "2025-11-29",
      });

      getRecurringGroceryById.mockResolvedValue(mockRecurring);
      calculateNextOccurrence.mockReturnValue("2025-12-06");

      const recurring = await getRecurringGroceryById("r1");

      expect(recurring).toBeDefined();
      expect(recurring!.recurrenceRule).toBe("week");

      const pattern = {
        rule: recurring!.recurrenceRule,
        interval: recurring!.recurrenceInterval,
        weekday: recurring!.recurrenceWeekday,
      };
      const nextDate = calculateNextOccurrence(pattern, "2025-11-29");

      expect(nextDate).toBe("2025-12-06");
    });

    it("does nothing when recurring grocery not found", async () => {
      getRecurringGroceryById.mockResolvedValue(null);

      const result = await getRecurringGroceryById("non-existent");

      expect(result).toBeNull();
    });
  });
});

describe("a repeating grocery asks its Store what it knows", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  const storeId = crypto.randomUUID();
  const link = {
    storeId,
    normalizedName: "melk",
    triedAt: new Date(),
    product: { id: crypto.randomUUID(), storeId, name: "Halfvolle melk 1 L", price: 1.29 },
  };
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
    getRecurringGroceryOwnerId.mockResolvedValue(ctx.user.id);
    assertHouseholdAccess.mockResolvedValue(undefined);
    storeProductsRepository.resolveProductLinks.mockResolvedValue([link]);
    // Pricing answers only for the household's own Stores.
    storesRepository.listStoresByUserIds.mockResolvedValue([{ id: storeId, searchAddress: null }]);
  });

  // Every other way a grocery lands on the list under a Store asks that Store
  // what it knows about the name — the add panel, a rename, a drag. A grocery
  // that repeats is a grocery like any other, and without this it sat unpriced
  // until the whole list was fetched again.
  it("when it is created", async () => {
    const mockRecurring = createMockRecurringGrocery({ id: "r1", name: "melk" });
    const mockGrocery = createMockGrocery({ id: "g1", name: "melk", storeId });

    createRecurringGrocery.mockResolvedValue(mockRecurring);
    createGrocery.mockResolvedValue({ created: mockGrocery, shifted: [] });

    const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

    await caller.createRecurring({
      name: "melk",
      amount: null,
      unit: null,
      recurrenceRule: "week",
      recurrenceInterval: 1,
      recurrenceWeekday: null,
      nextPlannedFor: "2026-09-07",
      storeId,
    });

    expect(storeProductsRepository.resolveProductLinks).toHaveBeenCalledWith([
      { storeId, name: "melk" },
    ]);
    expect(storeEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "linkUpdated", {
      link,
    });
  });

  it("when it is renamed or moved", async () => {
    const mockRecurring = createMockRecurringGrocery({ id: "r1", name: "melk" });
    const mockGrocery = createMockGrocery({ id: "g1", name: "melk", storeId });

    updateRecurringGroceryWithGrocery.mockResolvedValue({
      applied: true,
      stale: false,
      value: { recurringGrocery: mockRecurring, grocery: mockGrocery },
    });

    const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

    await caller.updateRecurring({
      recurringGroceryId: "r1",
      recurringVersion: 2,
      groceryId: "g1",
      groceryVersion: 3,
      storeId,
      data: { name: "melk" },
    });
    await flushAsync();

    expect(storeEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "linkUpdated", {
      link,
    });
  });

  it("when it stops repeating and is edited in the same breath", async () => {
    const recurringGroceryId = crypto.randomUUID();
    const groceryId = crypto.randomUUID();
    const detached = createMockGrocery({
      id: groceryId,
      name: "melk",
      recurringGroceryId: null,
      storeId,
    });

    detachRecurringGrocery.mockResolvedValue({ applied: true, stale: false, value: detached });

    const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

    await caller.detachRecurring({
      recurringGroceryId,
      recurringVersion: 2,
      groceryId,
      groceryVersion: 3,
      raw: "melk",
      storeId,
    });
    await flushAsync();

    expect(storeEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "linkUpdated", {
      link,
    });
  });
});

describe("recurrence rules", () => {
  it("supports daily recurrence", () => {
    const recurring = createMockRecurringGrocery({
      recurrenceRule: "day",
      recurrenceInterval: 1,
    });

    expect(recurring.recurrenceRule).toBe("day");
    expect(recurring.recurrenceInterval).toBe(1);
  });

  it("supports weekly recurrence with specific weekday", () => {
    const recurring = createMockRecurringGrocery({
      recurrenceRule: "week",
      recurrenceInterval: 1,
      recurrenceWeekday: 1,
    });

    expect(recurring.recurrenceRule).toBe("week");
    expect(recurring.recurrenceWeekday).toBe(1);
  });

  it("supports monthly recurrence", () => {
    const recurring = createMockRecurringGrocery({
      recurrenceRule: "month",
      recurrenceInterval: 1,
    });

    expect(recurring.recurrenceRule).toBe("month");
  });

  it("supports custom intervals", () => {
    const recurring = createMockRecurringGrocery({
      recurrenceRule: "week",
      recurrenceInterval: 2,
    });

    expect(recurring.recurrenceInterval).toBe(2);
  });
});
