// @vitest-environment node
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPlannedRecipeProcedure,
  deletePlannedRecipeProcedure,
  listMonthPlannedRecipesProcedure,
  listTodayPlannedRecipesProcedure,
  listWeekPlannedRecipesProcedure,
} from "../../src/routers/calendar/planned-items";
import { router } from "../../src/trpc";
import { assertHouseholdAccess } from "../mocks/permissions";
import {
  createPlannedItem,
  deletePlannedItem,
  getPlannedItemById,
  getPlannedItemOwnerId,
  getPlannedItemWithRecipeById,
  listPlannedItemsByUserAndDateRange,
  moveItem,
} from "../mocks/planned-items";
import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

vi.mock("@norish/db/repositories/planned-items", () => import("../mocks/planned-items"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/calendar/emitter", () => import("../mocks/calendar-emitter"));
vi.mock("@norish/config/server-config-loader", () => import("../mocks/config"));

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

function createMockPlannedItem(overrides: Record<string, unknown> = {}) {
  return {
    id: `item-${crypto.randomUUID()}`,
    userId: "test-user-id",
    date: "2025-01-15",
    slot: "Breakfast" as const,
    sortOrder: 0,
    itemType: "recipe" as const,
    recipeId: "recipe-1",
    title: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createTestCaller(ctx: ReturnType<typeof createMockAuthedContext>) {
  const testRouter = t.router({
    moveItem: t.procedure
      .input(
        (v) =>
          v as {
            itemId: string;
            targetDate: string;
            targetSlot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
            targetIndex: number;
          }
      )
      .mutation(async ({ input }) => {
        const { itemId, targetDate, targetSlot, targetIndex } = input;

        const item = await getPlannedItemById(itemId);

        if (!item) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Planned item not found",
          });
        }

        await assertHouseholdAccess(ctx.user.id, item.userId);

        if (
          item.date === targetDate &&
          item.slot === targetSlot &&
          item.sortOrder === targetIndex
        ) {
          return { success: true, moved: false };
        }

        const movedItem = await moveItem(itemId, targetDate, targetSlot, targetIndex);

        if (!movedItem) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to move item",
          });
        }

        return { success: true, moved: true };
      }),

    createItem: t.procedure
      .input(
        (v) =>
          v as {
            date: string;
            slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
            itemType: "recipe" | "note";
            recipeId?: string;
            title?: string;
          }
      )
      .mutation(async ({ input }) => {
        const { date, slot, itemType, recipeId, title } = input;

        if (itemType === "recipe" && !recipeId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "recipeId is required for recipe items",
          });
        }

        if (itemType === "note" && !title) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "title is required for note items",
          });
        }

        const newItem = await createPlannedItem({
          userId: ctx.user.id,
          date,
          slot,
          itemType,
          recipeId: recipeId ?? null,
          title: title ?? null,
        });

        return { id: newItem.id };
      }),

    deleteItem: t.procedure
      .input((v) => v as { itemId: string })
      .mutation(async ({ input }) => {
        const { itemId } = input;

        const ownerId = await getPlannedItemOwnerId(itemId);

        if (!ownerId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Planned item not found",
          });
        }

        await assertHouseholdAccess(ctx.user.id, ownerId);

        await deletePlannedItem(itemId);

        return { success: true };
      }),
  });

  return t.createCallerFactory(testRouter)(ctx);
}

const openApiCalendarRouter = router({
  listTodayPlannedRecipes: listTodayPlannedRecipesProcedure,
  listWeekPlannedRecipes: listWeekPlannedRecipesProcedure,
  listMonthPlannedRecipes: listMonthPlannedRecipesProcedure,
  createPlannedRecipe: createPlannedRecipeProcedure,
  deletePlannedRecipe: deletePlannedRecipeProcedure,
});

describe("calendar planned recipe openapi procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists today's planned recipes only", async () => {
    listPlannedItemsByUserAndDateRange.mockResolvedValue([
      {
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
        itemType: "recipe",
        recipeId: crypto.randomUUID(),
        title: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        recipeName: "Omelette",
        recipeImage: null,
        servings: 2,
        calories: 250,
      },
      {
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        date: "2025-01-15",
        slot: "Lunch",
        sortOrder: 0,
        itemType: "note",
        recipeId: null,
        title: "Leftovers",
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        recipeName: null,
        recipeImage: null,
        servings: null,
        calories: null,
      },
    ]);

    const caller = openApiCalendarRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.listTodayPlannedRecipes();

    expect(listPlannedItemsByUserAndDateRange).toHaveBeenCalledWith(
      ctx.userIds,
      "2025-01-15",
      "2025-01-15"
    );
    expect(result).toEqual([
      {
        id: expect.any(String),
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
        recipeId: expect.any(String),
        version: 1,
        recipeName: "Omelette",
        recipeImage: null,
        servings: 2,
        calories: 250,
      },
    ]);
  });

  it("lists the current week's planned recipes using server time", async () => {
    listPlannedItemsByUserAndDateRange.mockResolvedValue([]);

    const caller = openApiCalendarRouter.createCaller({ ...ctx, multiplexer: null } as any);
    await caller.listWeekPlannedRecipes();

    expect(listPlannedItemsByUserAndDateRange).toHaveBeenCalledWith(
      ctx.userIds,
      "2025-01-13",
      "2025-01-19"
    );
  });

  it("lists the current month's planned recipes using server time", async () => {
    listPlannedItemsByUserAndDateRange.mockResolvedValue([]);

    const caller = openApiCalendarRouter.createCaller({ ...ctx, multiplexer: null } as any);
    await caller.listMonthPlannedRecipes();

    expect(listPlannedItemsByUserAndDateRange).toHaveBeenCalledWith(
      ctx.userIds,
      "2025-01-01",
      "2025-01-31"
    );
  });

  it("creates a planned recipe item", async () => {
    const itemId = crypto.randomUUID();
    const recipeId = crypto.randomUUID();

    createPlannedItem.mockResolvedValue({
      id: itemId,
      userId: ctx.user.id,
      date: "2025-01-20",
      slot: "Dinner",
      sortOrder: 0,
      itemType: "recipe",
      recipeId,
      title: null,
      version: 1,
    });
    getPlannedItemWithRecipeById.mockResolvedValue({
      id: itemId,
      userId: ctx.user.id,
      date: "2025-01-20",
      slot: "Dinner",
      sortOrder: 0,
      itemType: "recipe",
      recipeId,
      title: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      recipeName: "Pasta",
      recipeImage: null,
      servings: 4,
      calories: 600,
    });

    const caller = openApiCalendarRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.createPlannedRecipe({
      date: "2025-01-20",
      slot: "Dinner",
      recipeId,
    });

    expect(createPlannedItem).toHaveBeenCalledWith({
      userId: ctx.user.id,
      date: "2025-01-20",
      slot: "Dinner",
      itemType: "recipe",
      recipeId,
      title: null,
    });
    expect(result).toEqual({ id: itemId });
  });

  it("deletes a planned recipe item", async () => {
    const itemId = crypto.randomUUID();

    getPlannedItemById.mockResolvedValue({
      id: itemId,
      userId: ctx.user.id,
      date: "2025-01-20",
      slot: "Dinner",
      sortOrder: 0,
      itemType: "recipe",
      recipeId: crypto.randomUUID(),
      title: null,
      version: 2,
    });
    deletePlannedItem.mockResolvedValue({ stale: false, value: {} });
    assertHouseholdAccess.mockResolvedValue(undefined);

    const caller = openApiCalendarRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.deletePlannedRecipe({ itemId, version: 2 });

    expect(result).toEqual({ success: true, stale: false });
  });
});

describe("calendar planned items procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  describe("moveItem", () => {
    it("moves item within same slot (reorder)", async () => {
      const mockItem = createMockPlannedItem({
        id: "item-123",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      const movedItem = createMockPlannedItem({
        ...mockItem,
        sortOrder: 2,
      });

      getPlannedItemById.mockResolvedValue(mockItem);
      assertHouseholdAccess.mockResolvedValue(undefined);
      moveItem.mockResolvedValue(movedItem);

      const caller = createTestCaller(ctx);
      const result = await caller.moveItem({
        itemId: "item-123",
        targetDate: "2025-01-15",
        targetSlot: "Breakfast",
        targetIndex: 2,
      });

      expect(getPlannedItemById).toHaveBeenCalledWith("item-123");
      expect(assertHouseholdAccess).toHaveBeenCalledWith(ctx.user.id, mockItem.userId);
      expect(moveItem).toHaveBeenCalledWith("item-123", "2025-01-15", "Breakfast", 2);
      expect(result).toEqual({ success: true, moved: true });
    });

    it("moves item to different slot same day", async () => {
      const mockItem = createMockPlannedItem({
        id: "item-123",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      const movedItem = createMockPlannedItem({
        ...mockItem,
        slot: "Dinner",
        sortOrder: 0,
      });

      getPlannedItemById.mockResolvedValue(mockItem);
      assertHouseholdAccess.mockResolvedValue(undefined);
      moveItem.mockResolvedValue(movedItem);

      const caller = createTestCaller(ctx);
      const result = await caller.moveItem({
        itemId: "item-123",
        targetDate: "2025-01-15",
        targetSlot: "Dinner",
        targetIndex: 0,
      });

      expect(moveItem).toHaveBeenCalledWith("item-123", "2025-01-15", "Dinner", 0);
      expect(result).toEqual({ success: true, moved: true });
    });

    it("moves item to different day", async () => {
      const mockItem = createMockPlannedItem({
        id: "item-123",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      const movedItem = createMockPlannedItem({
        ...mockItem,
        date: "2025-01-20",
        slot: "Lunch",
        sortOrder: 1,
      });

      getPlannedItemById.mockResolvedValue(mockItem);
      assertHouseholdAccess.mockResolvedValue(undefined);
      moveItem.mockResolvedValue(movedItem);

      const caller = createTestCaller(ctx);
      const result = await caller.moveItem({
        itemId: "item-123",
        targetDate: "2025-01-20",
        targetSlot: "Lunch",
        targetIndex: 1,
      });

      expect(moveItem).toHaveBeenCalledWith("item-123", "2025-01-20", "Lunch", 1);
      expect(result).toEqual({ success: true, moved: true });
    });

    it("returns no-op when position unchanged", async () => {
      const mockItem = createMockPlannedItem({
        id: "item-123",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 2,
      });

      getPlannedItemById.mockResolvedValue(mockItem);
      assertHouseholdAccess.mockResolvedValue(undefined);

      const caller = createTestCaller(ctx);
      const result = await caller.moveItem({
        itemId: "item-123",
        targetDate: "2025-01-15",
        targetSlot: "Breakfast",
        targetIndex: 2,
      });

      expect(getPlannedItemById).toHaveBeenCalledWith("item-123");
      expect(assertHouseholdAccess).toHaveBeenCalledWith(ctx.user.id, mockItem.userId);
      expect(moveItem).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, moved: false });
    });

    it("throws error when item not found", async () => {
      getPlannedItemById.mockResolvedValue(null);

      const caller = createTestCaller(ctx);

      await expect(
        caller.moveItem({
          itemId: "non-existent",
          targetDate: "2025-01-15",
          targetSlot: "Breakfast",
          targetIndex: 0,
        })
      ).rejects.toThrow("Planned item not found");

      expect(moveItem).not.toHaveBeenCalled();
    });

    it("throws error when user lacks permission", async () => {
      const mockItem = createMockPlannedItem({
        id: "item-123",
        userId: "other-user-id",
      });

      getPlannedItemById.mockResolvedValue(mockItem);
      assertHouseholdAccess.mockRejectedValue(new Error("Access denied"));

      const caller = createTestCaller(ctx);

      await expect(
        caller.moveItem({
          itemId: "item-123",
          targetDate: "2025-01-15",
          targetSlot: "Breakfast",
          targetIndex: 0,
        })
      ).rejects.toThrow("Access denied");

      expect(moveItem).not.toHaveBeenCalled();
    });

    it("handles move to note item correctly", async () => {
      const mockItem = createMockPlannedItem({
        id: "note-123",
        itemType: "note",
        recipeId: null,
        title: "My Note",
        date: "2025-01-15",
        slot: "Lunch",
        sortOrder: 0,
      });

      const movedItem = {
        ...mockItem,
        slot: "Dinner",
        sortOrder: 1,
      };

      getPlannedItemById.mockResolvedValue(mockItem);
      assertHouseholdAccess.mockResolvedValue(undefined);
      moveItem.mockResolvedValue(movedItem);

      const caller = createTestCaller(ctx);
      const result = await caller.moveItem({
        itemId: "note-123",
        targetDate: "2025-01-15",
        targetSlot: "Dinner",
        targetIndex: 1,
      });

      expect(moveItem).toHaveBeenCalledWith("note-123", "2025-01-15", "Dinner", 1);
      expect(result).toEqual({ success: true, moved: true });
    });
  });

  describe("createItem", () => {
    it("creates a recipe item at end of slot", async () => {
      const newItem = createMockPlannedItem({
        id: "new-item-123",
        itemType: "recipe",
        recipeId: "recipe-456",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      createPlannedItem.mockResolvedValue(newItem);

      const caller = createTestCaller(ctx);
      const result = await caller.createItem({
        date: "2025-01-15",
        slot: "Breakfast",
        itemType: "recipe",
        recipeId: "recipe-456",
      });

      expect(createPlannedItem).toHaveBeenCalledWith({
        userId: ctx.user.id,
        date: "2025-01-15",
        slot: "Breakfast",
        itemType: "recipe",
        recipeId: "recipe-456",
        title: null,
      });
      expect(result).toEqual({ id: "new-item-123" });
    });

    it("creates a note item at end of slot", async () => {
      const newItem = createMockPlannedItem({
        id: "new-note-123",
        itemType: "note",
        recipeId: null,
        title: "My Note",
        date: "2025-01-15",
        slot: "Lunch",
        sortOrder: 0,
      });

      createPlannedItem.mockResolvedValue(newItem);

      const caller = createTestCaller(ctx);
      const result = await caller.createItem({
        date: "2025-01-15",
        slot: "Lunch",
        itemType: "note",
        title: "My Note",
      });

      expect(createPlannedItem).toHaveBeenCalledWith({
        userId: ctx.user.id,
        date: "2025-01-15",
        slot: "Lunch",
        itemType: "note",
        recipeId: null,
        title: "My Note",
      });
      expect(result).toEqual({ id: "new-note-123" });
    });

    it("throws error when recipe item missing recipeId", async () => {
      const caller = createTestCaller(ctx);

      await expect(
        caller.createItem({
          date: "2025-01-15",
          slot: "Breakfast",
          itemType: "recipe",
        })
      ).rejects.toThrow("recipeId is required for recipe items");

      expect(createPlannedItem).not.toHaveBeenCalled();
    });

    it("throws error when note item missing title", async () => {
      const caller = createTestCaller(ctx);

      await expect(
        caller.createItem({
          date: "2025-01-15",
          slot: "Breakfast",
          itemType: "note",
        })
      ).rejects.toThrow("title is required for note items");

      expect(createPlannedItem).not.toHaveBeenCalled();
    });
  });

  describe("deleteItem", () => {
    it("deletes item and reindexes slot", async () => {
      getPlannedItemOwnerId.mockResolvedValue("test-user-id");
      assertHouseholdAccess.mockResolvedValue(undefined);
      deletePlannedItem.mockResolvedValue([]);

      const caller = createTestCaller(ctx);
      const result = await caller.deleteItem({ itemId: "item-123" });

      expect(getPlannedItemOwnerId).toHaveBeenCalledWith("item-123");
      expect(assertHouseholdAccess).toHaveBeenCalledWith(ctx.user.id, "test-user-id");
      expect(deletePlannedItem).toHaveBeenCalledWith("item-123");
      expect(result).toEqual({ success: true });
    });

    it("throws error when item not found", async () => {
      getPlannedItemOwnerId.mockResolvedValue(null);

      const caller = createTestCaller(ctx);

      await expect(caller.deleteItem({ itemId: "non-existent" })).rejects.toThrow(
        "Planned item not found"
      );

      expect(deletePlannedItem).not.toHaveBeenCalled();
    });

    it("throws error when user lacks permission", async () => {
      getPlannedItemOwnerId.mockResolvedValue("other-user-id");
      assertHouseholdAccess.mockRejectedValue(new Error("Access denied"));

      const caller = createTestCaller(ctx);

      await expect(caller.deleteItem({ itemId: "item-123" })).rejects.toThrow("Access denied");

      expect(deletePlannedItem).not.toHaveBeenCalled();
    });
  });
});
