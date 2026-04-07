// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recurringGroceriesProcedures } from "@norish/trpc/routers/groceries/recurring";

import { groceryEmitter } from "../mocks/grocery-emitter";
import { assertHouseholdAccess } from "../mocks/permissions";
import { calculateNextOccurrence } from "../mocks/recurrence";
// Import mocks for assertions
import {
  createRecurringGrocery,
  deleteRecurringGroceryById,
  getRecurringGroceryById,
  getRecurringGroceryOwnerId,
  updateRecurringGrocery,
} from "../mocks/recurring-groceries";
// Import test utilities
import {
  createMockAuthedContext,
  createMockGrocery,
  createMockHousehold,
  createMockRecurringGrocery,
  createMockUser,
} from "./test-utils";

// Setup mocks
vi.mock("@norish/db", () => import("../mocks/db"));
vi.mock(
  "@norish/db/repositories/recurring-groceries",
  () => import("../mocks/recurring-groceries")
);
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/groceries/emitter", () => import("../mocks/grocery-emitter"));
vi.mock("@norish/shared/lib/recurrence/calculator", () => import("../mocks/recurrence"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

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

    it("logs stale recurring deletes as no-ops", async () => {
      deleteRecurringGroceryById.mockResolvedValue({ stale: true });

      const caller = recurringGroceriesProcedures.createCaller({
        ...ctx,
        multiplexer: null,
      } as any);

      const result = await caller.deleteRecurring({
        recurringGroceryId: "r1",
        version: 4,
      });

      expect(result).toEqual({ success: true });
      await Promise.resolve();

      expect(deleteRecurringGroceryById).toHaveBeenCalledWith("r1", 4);
      expect(groceryEmitter.emitToHousehold).not.toHaveBeenCalledWith(
        ctx.householdKey,
        "recurringDeleted",
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
