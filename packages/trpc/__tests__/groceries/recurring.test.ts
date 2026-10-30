// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recurringGroceriesProcedures } from "@norish/trpc/routers/groceries/recurring";

// Import test utilities
import { createMockCallerContext } from "../calendar/test-utils";
import { createGroceries, listGroceriesByUsers, lockGroceryList } from "../mocks/db";
import { TX } from "../mocks/drizzle";
import { parseIngredientWithDefaults } from "../mocks/helpers";
import { resolveGroceryNames } from "../mocks/ingredient-groceries";
import { assertHouseholdAccess } from "../mocks/permissions";
import { groceries } from "../mocks/realtime/groceries";
import { stores } from "../mocks/realtime/stores";
import { calculateNextOccurrence } from "../mocks/recurrence";
// Import mocks for assertions
import {
  checkRecurringGrocery,
  createRecurringGroceries,
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
  flushAsync,
} from "./test-utils";

const storesRepository = vi.hoisted(() => ({
  findBestIngredientStorePreference: vi.fn(),
  getStoreOwnerId: vi.fn(),
  upsertIngredientStorePreference: vi.fn(),
  // A household with no Store that points at a shop: pricing notices the
  // groceries, finds nothing to ask, and visits nothing.
  listStoresByUserIds: vi.fn(async () => []),
}));

const storeProductsRepository = vi.hoisted(() => ({
  resolveProductLinks: vi.fn(async () => [] as unknown[]),
  listStaleProducts: vi.fn(async () => []),
}));

// Setup mocks
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
vi.mock("@norish/shared/lib/recurrence/calculator", () => import("../mocks/recurrence"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

type Rows = Array<{
  recurring: { id: string; name: string };
  grocery: { id: string; groceries: { name: string | null; storeId: string | null } };
}>;

/** Each recurring grocery made as asked, with its grocery. */
const madeAsAsked = async (rows: Rows) => ({
  created: rows.map(({ recurring, grocery }) => ({
    recurringGrocery: createMockRecurringGrocery(recurring),
    grocery: createMockGrocery({
      id: grocery.id,
      ...grocery.groceries,
      recurringGroceryId: recurring.id,
    }),
  })),
  shifted: [],
});

/** Each grocery made as asked. */
const groceriesAsAsked = async (
  items: Array<{ id: string; groceries: { name: string | null } }>
) => ({
  created: items.map(({ id, groceries }) => createMockGrocery({ id, name: groceries.name })),
  shifted: [],
});

describe("recurring groceries procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    ctx = createMockAuthedContext(mockUser, mockHousehold);
    getRecurringGroceryOwnerId.mockResolvedValue(ctx.user.id);
    assertHouseholdAccess.mockResolvedValue(undefined);
    createRecurringGroceries.mockImplementation(madeAsAsked);
    listGroceriesByUsers.mockResolvedValue([]);
    createGroceries.mockImplementation(groceriesAsAsked);
  });

  describe("createRecurring", () => {
    it("creates recurring grocery and initial grocery item", async () => {
      const result = await recurringGroceriesProcedures
        .createCaller(createMockCallerContext(ctx))
        .createRecurring({
          name: "Weekly Milk",
          amount: 2,
          unit: "liters",
          recurrenceRule: "week",
          recurrenceInterval: 1,
          recurrenceWeekday: null,
          nextPlannedFor: "2025-12-01",
        });

      expect(result.recurringGrocery).toMatchObject({
        name: "Weekly Milk",
        recurrenceRule: "week",
      });
      expect(result.grocery).toMatchObject({
        name: "Weekly Milk",
        recurringGroceryId: result.recurringGrocery.id,
      });
    });

    it("emits recurringCreated event after success", () => {
      const mockRecurring = createMockRecurringGrocery({ id: "r1" });
      const mockGrocery = createMockGrocery({ id: "g1", recurringGroceryId: "r1" });

      void groceries.publish(
        "recurringCreated",
        {
          recurringGrocery: mockRecurring,
          grocery: mockGrocery,
        },
        { householdKey: ctx.householdKey }
      );

      expect(groceries.publish).toHaveBeenCalledWith(
        "recurringCreated",
        expect.objectContaining({
          recurringGrocery: mockRecurring,
          grocery: mockGrocery,
        }),
        { householdKey: ctx.householdKey }
      );
    });

    it("inserts the recurring row with the client-minted id when one is supplied", async () => {
      const clientId = crypto.randomUUID();
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

      expect(createRecurringGroceries).toHaveBeenCalledWith(
        [expect.objectContaining({ recurring: expect.objectContaining({ id: clientId }) })],
        ctx.userIds
      );
    });

    it("repeats each food a name joins as a recurring grocery of its own, on the same rule", async () => {
      const clientId = crypto.randomUUID();
      const result = await recurringGroceriesProcedures
        .createCaller(createMockCallerContext(ctx))
        .createRecurring({
          id: clientId,
          name: "zout en peper",
          amount: 1,
          unit: null,
          recurrenceRule: "month",
          recurrenceInterval: 2,
          recurrenceWeekday: null,
          nextPlannedFor: "2025-12-01",
        });
      const rule = {
        recurrenceRule: "month",
        recurrenceInterval: 2,
        recurrenceWeekday: null,
        nextPlannedFor: "2025-12-01",
      };

      expect(result.recurringGrocery).toMatchObject({ id: clientId, name: "zout" });
      // One write, so the foods are made all or none.
      expect(createRecurringGroceries).toHaveBeenCalledTimes(1);
      expect(createRecurringGroceries).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            recurring: expect.objectContaining({ id: clientId, name: "zout", ...rule }),
          }),
          expect.objectContaining({
            recurring: expect.objectContaining({
              id: expect.not.stringMatching(clientId),
              name: "peper",
              ingredientAliasId: "alias:peper",
              ...rule,
            }),
          }),
        ],
        ctx.userIds
      );
      for (const name of ["zout", "peper"]) {
        expect(groceries.publish).toHaveBeenCalledWith(
          "recurringCreated",
          {
            recurringGrocery: expect.objectContaining({ name }),
            grocery: expect.objectContaining({ name }),
          },
          { householdKey: ctx.householdKey }
        );
      }
    });

    it("resolves the name once, for the recurring grocery and the line it puts on the list", async () => {
      await recurringGroceriesProcedures
        .createCaller(createMockCallerContext(ctx))
        .createRecurring({
          id: crypto.randomUUID(),
          name: "Melk",
          amount: 1,
          unit: null,
          recurrenceRule: "week",
          recurrenceInterval: 1,
          recurrenceWeekday: null,
          nextPlannedFor: "2025-12-01",
        });

      expect(resolveGroceryNames).toHaveBeenCalledTimes(1);
      expect(createRecurringGroceries).toHaveBeenCalledWith(
        [
          {
            recurring: expect.objectContaining({ name: "Melk", ingredientAliasId: "alias:melk" }),
            grocery: expect.objectContaining({
              groceries: expect.objectContaining({ name: "Melk", ingredientAliasId: "alias:melk" }),
            }),
          },
        ],
        ctx.userIds
      );
    });
  });

  describe("updateRecurring", () => {
    it("resolves its name knowing the grocery it keeps on the list, as a detach does", async () => {
      const recurringGroceryId = crypto.randomUUID();
      const groceryId = crypto.randomUUID();
      const caller = recurringGroceriesProcedures.createCaller(createMockCallerContext(ctx));

      updateRecurringGroceryWithGrocery.mockResolvedValue({ stale: true });
      detachRecurringGrocery.mockResolvedValue({ stale: true });

      await caller.updateRecurring({
        recurringGroceryId,
        recurringVersion: 1,
        groceryId,
        groceryVersion: 1,
        data: { name: "Melk" },
      });
      await caller.detachRecurring({
        recurringGroceryId,
        recurringVersion: 1,
        groceryId,
        groceryVersion: 1,
        raw: "Melk",
      });
      await flushAsync();

      expect(resolveGroceryNames).toHaveBeenCalledWith(
        [expect.objectContaining({ name: "Melk", groceryId })],
        { userId: ctx.user.id }
      );
      expect(resolveGroceryNames).toHaveBeenCalledWith(
        [expect.objectContaining({ name: "Test", groceryId })],
        { userId: ctx.user.id }
      );
    });

    it("renames to the first food a name joins and repeats the rest on the same rule", async () => {
      const recurringGroceryId = crypto.randomUUID();
      const groceryId = crypto.randomUUID();
      const renamed = createMockRecurringGrocery({
        id: recurringGroceryId,
        name: "zout",
        recurrenceRule: "month",
        recurrenceInterval: 2,
        nextPlannedFor: "2025-12-01",
      });

      updateRecurringGroceryWithGrocery.mockResolvedValue({
        stale: false,
        value: { recurringGrocery: renamed, grocery: createMockGrocery({ id: groceryId }) },
      });

      await recurringGroceriesProcedures
        .createCaller(createMockCallerContext(ctx))
        .updateRecurring({
          recurringGroceryId,
          recurringVersion: 1,
          groceryId,
          groceryVersion: 1,
          data: { name: "zout en peper" },
        });

      // The rename and the new food are one transaction.
      await vi.waitFor(() =>
        expect(createRecurringGroceries).toHaveBeenCalledWith(
          [
            expect.objectContaining({
              recurring: expect.objectContaining({
                name: "peper",
                recurrenceRule: "month",
                recurrenceInterval: 2,
                nextPlannedFor: "2025-12-01",
              }),
            }),
          ],
          ctx.userIds,
          TX
        )
      );
      expect(updateRecurringGroceryWithGrocery).toHaveBeenCalledWith(
        expect.objectContaining({ id: recurringGroceryId, name: "zout" }),
        expect.anything(),
        TX
      );
      expect(lockGroceryList.mock.invocationCallOrder[0]).toBeLessThan(
        updateRecurringGroceryWithGrocery.mock.invocationCallOrder[0]!
      );
      // The new food keeps nothing of the grocery being renamed.
      expect(resolveGroceryNames).toHaveBeenCalledWith(
        [{ name: "zout", groceryId }, { name: "peper" }],
        { userId: ctx.user.id }
      );
    });

    it("repeats none of a renamed recurring grocery's other foods when the rename was stale", async () => {
      updateRecurringGroceryWithGrocery.mockResolvedValue({ stale: true });

      await recurringGroceriesProcedures
        .createCaller(createMockCallerContext(ctx))
        .updateRecurring({
          recurringGroceryId: crypto.randomUUID(),
          recurringVersion: 1,
          groceryId: crypto.randomUUID(),
          groceryVersion: 1,
          data: { name: "zout en peper" },
        });
      await flushAsync();

      expect(groceries.publish).toHaveBeenCalledWith("stale", expect.anything(), {
        householdKey: ctx.householdKey,
      });
      expect(createRecurringGroceries).not.toHaveBeenCalled();
    });

    it("detaches a grocery renamed to a name joining foods as a grocery per food", async () => {
      const recurringGroceryId = crypto.randomUUID();
      const groceryId = crypto.randomUUID();

      parseIngredientWithDefaults.mockReturnValueOnce([
        { description: "zout en peper", quantity: 1, unitOfMeasure: null },
      ]);
      detachRecurringGrocery.mockResolvedValue({
        stale: false,
        value: createMockGrocery({ id: groceryId, name: "zout" }),
      });

      await recurringGroceriesProcedures
        .createCaller(createMockCallerContext(ctx))
        .detachRecurring({
          recurringGroceryId,
          recurringVersion: 1,
          groceryId,
          groceryVersion: 1,
          raw: "zout en peper",
        });

      await vi.waitFor(() =>
        expect(groceries.publish).toHaveBeenCalledWith(
          "created",
          { groceries: [expect.objectContaining({ name: "peper" })] },
          { householdKey: ctx.householdKey }
        )
      );
      // The detach and the new grocery are one transaction.
      expect(detachRecurringGrocery).toHaveBeenCalledWith(
        expect.objectContaining({ grocery: expect.objectContaining({ name: "zout" }) }),
        TX
      );
      expect(createGroceries).toHaveBeenCalledWith(
        [expect.objectContaining({ groceries: expect.objectContaining({ name: "peper" }) })],
        ctx.userIds,
        TX
      );
    });

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

      void groceries.publish(
        "recurringUpdated",
        {
          recurringGrocery: mockRecurring,
          grocery: mockGrocery,
        },
        { householdKey: ctx.householdKey }
      );

      expect(groceries.publish).toHaveBeenCalledWith(
        "recurringUpdated",
        expect.objectContaining({
          recurringGrocery: mockRecurring,
          grocery: mockGrocery,
        }),
        { householdKey: ctx.householdKey }
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

      void groceries.publish(
        "recurringDeleted",
        {
          recurringGroceryId,
        },
        { householdKey: ctx.householdKey }
      );

      expect(groceries.publish).toHaveBeenCalledWith(
        "recurringDeleted",
        { recurringGroceryId },
        { householdKey: ctx.householdKey }
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
      expect(groceries.publish).toHaveBeenCalledWith(
        "deleted",
        {
          groceryIds: ["g1", "g2"],
        },
        { householdKey: ctx.householdKey }
      );
      expect(groceries.publish).toHaveBeenCalledWith(
        "recurringDeleted",
        { recurringGroceryId: "r1" },
        { householdKey: ctx.householdKey }
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
      expect(groceries.publish).not.toHaveBeenCalledWith("recurringDeleted", expect.anything(), {
        householdKey: ctx.householdKey,
      });
      expect(groceries.publish).toHaveBeenCalledWith(
        "stale",
        {
          reason: expect.any(String),
        },
        { householdKey: ctx.householdKey }
      );
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
        {
          id: "r1",
          version: 2,
          name: "Oat milk",
          ingredientAliasId: "alias:oat milk",
          ingredientId: "ingredient:oat milk",
        },
        { id: "g1", version: 3, storeId: undefined },
        TX
      );
      expect(groceries.publish).toHaveBeenCalledWith(
        "recurringUpdated",
        { recurringGrocery: mockRecurring, grocery: mockGrocery },
        { householdKey: ctx.householdKey }
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
        {
          id: "r1",
          version: 2,
          name: "Oat Milk",
          ingredientAliasId: "alias:oat milk",
          ingredientId: "ingredient:oat milk",
        },
        { id: "g1", version: 3, storeId },
        TX
      );
      expect(storesRepository.upsertIngredientStorePreference).toHaveBeenCalledWith(
        ctx.user.id,
        "ingredient:oat milk",
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
      expect(groceries.publish).toHaveBeenCalledWith(
        "stale",
        {
          reason: expect.any(String),
        },
        { householdKey: ctx.householdKey }
      );
      expect(groceries.publish).not.toHaveBeenCalledWith("recurringUpdated", expect.anything(), {
        householdKey: ctx.householdKey,
      });
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
      expect(detachRecurringGrocery).toHaveBeenCalledWith(
        {
          recurringGroceryId,
          recurringVersion: 2,
          grocery: {
            id: groceryId,
            version: 3,
            name: "Test",
            ingredientAliasId: "alias:test",
            ingredientId: "ingredient:test",
            unit: "piece",
            amount: 1,
          },
        },
        TX
      );
      expect(groceries.publish).toHaveBeenCalledWith(
        "recurringDeleted",
        { recurringGroceryId },
        { householdKey: ctx.householdKey }
      );
      expect(groceries.publish).toHaveBeenCalledWith(
        "updated",
        {
          changedGroceries: [detached],
        },
        { householdKey: ctx.householdKey }
      );
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

      expect(detachRecurringGrocery).toHaveBeenCalledWith(
        {
          recurringGroceryId,
          recurringVersion: 2,
          grocery: {
            id: groceryId,
            version: 3,
            name: "Test",
            ingredientAliasId: "alias:test",
            ingredientId: "ingredient:test",
            unit: "piece",
            amount: 1,
            storeId,
          },
        },
        TX
      );
      expect(storesRepository.upsertIngredientStorePreference).toHaveBeenCalledWith(
        ctx.user.id,
        "ingredient:test",
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
      expect(groceries.publish).toHaveBeenCalledWith(
        "stale",
        {
          reason: expect.any(String),
        },
        { householdKey: ctx.householdKey }
      );
      expect(groceries.publish).not.toHaveBeenCalledWith("recurringDeleted", expect.anything(), {
        householdKey: ctx.householdKey,
      });
      expect(groceries.publish).not.toHaveBeenCalledWith("updated", expect.anything(), {
        householdKey: ctx.householdKey,
      });
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
      expect(groceries.publish).toHaveBeenCalledWith(
        "recurringUpdated",
        { recurringGrocery: advancedRecurring, grocery: checkedGrocery },
        { householdKey: ctx.householdKey }
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
      expect(groceries.publish).toHaveBeenCalledWith(
        "recurringUpdated",
        { recurringGrocery: mockRecurring, grocery: uncheckedGrocery },
        { householdKey: ctx.householdKey }
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
      expect(groceries.publish).toHaveBeenCalledWith(
        "stale",
        {
          reason: expect.any(String),
        },
        { householdKey: ctx.householdKey }
      );
      expect(groceries.publish).not.toHaveBeenCalledWith("recurringUpdated", expect.anything(), {
        householdKey: ctx.householdKey,
      });
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
    ingredientId: "ingredient:melk",
    triedAt: new Date(),
    product: { id: crypto.randomUUID(), storeId, name: "Halfvolle melk 1 L", price: 1.29 },
  };
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
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
    createRecurringGroceries.mockImplementation(madeAsAsked);

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
      { storeId, ingredientId: "ingredient:melk", name: "melk" },
    ]);
    expect(stores.publish).toHaveBeenCalledWith(
      "linkUpdated",
      {
        link,
      },
      { householdKey: ctx.householdKey }
    );
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

    expect(stores.publish).toHaveBeenCalledWith(
      "linkUpdated",
      {
        link,
      },
      { householdKey: ctx.householdKey }
    );
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

    expect(stores.publish).toHaveBeenCalledWith(
      "linkUpdated",
      {
        link,
      },
      { householdKey: ctx.householdKey }
    );
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
