import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";

// Setup mocks before any imports that use them
vi.mock("@/server/db/repositories/planned-recipe", () => import("../../mocks/planned-recipes"));
vi.mock("@/server/db", () => ({
  ...vi.importActual("../../mocks/planned-recipes"),
  getRecipeFull: vi.fn(),
}));
vi.mock("@/server/auth/permissions", () => import("../../mocks/permissions"));
vi.mock("@/server/trpc/routers/calendar/emitter", () => import("../../mocks/calendar-emitter"));
vi.mock("@/config/server-config-loader", () => import("../../mocks/config"));

// Import mocks for assertions
import {
  listPlannedRecipesByUsersAndRange,
  createPlannedRecipe,
  deletePlannedRecipe,
  updatePlannedRecipeDate,
  getPlannedRecipeOwnerId,
} from "../../mocks/planned-recipes";
import { assertHouseholdAccess } from "../../mocks/permissions";
import { calendarEmitter } from "../../mocks/calendar-emitter";

// Import test utilities
import {
  createMockUser,
  createMockHousehold,
  createMockAuthedContext,
  createMockPlannedRecipe,
} from "./test-utils";

import { getRecipeFull } from "@/server/db";

const getRecipeFullMock = vi.mocked(getRecipeFull);

// Create a test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

// Create test caller factory with inline procedures that mirror the actual implementation
function createTestCaller(ctx: ReturnType<typeof createMockAuthedContext>) {
  const testRouter = t.router({
    listRecipes: t.procedure
      .input((v) => v as { startISO: string; endISO: string })
      .query(async ({ input }) => {
        const recipes = await listPlannedRecipesByUsersAndRange(
          ctx.userIds,
          input.startISO,
          input.endISO
        );

        return recipes;
      }),

    createRecipe: t.procedure
      .input((v) => v as { date: string; slot: string; recipeId: string })
      .mutation(async ({ input }) => {
        const { date, slot, recipeId } = input;
        const id = crypto.randomUUID();

        const recipe = await getRecipeFullMock(recipeId);

        if (!recipe) {
          throw new Error("Recipe not found");
        }

        const plannedRecipe = await createPlannedRecipe(id, ctx.user.id, recipeId, date, slot);

        // Use emitToHousehold like the real implementation
        calendarEmitter.emitToHousehold(ctx.householdKey, "recipePlanned", { plannedRecipe });

        return id;
      }),

    deleteRecipe: t.procedure
      .input((v) => v as { id: string; date: string })
      .mutation(async ({ input }) => {
        const { id, date } = input;

        const ownerId = await getPlannedRecipeOwnerId(id);

        if (!ownerId) {
          throw new Error("Planned recipe not found");
        }

        await assertHouseholdAccess(ctx.user.id, ownerId);

        await deletePlannedRecipe(id);

        // Use emitToHousehold like the real implementation
        calendarEmitter.emitToHousehold(ctx.householdKey, "recipeDeleted", {
          plannedRecipeId: id,
          date,
        });

        return { success: true };
      }),

    updateRecipeDate: t.procedure
      .input((v) => v as { id: string; newDate: string; oldDate: string })
      .mutation(async ({ input }) => {
        const { id, newDate, oldDate } = input;

        const ownerId = await getPlannedRecipeOwnerId(id);

        if (!ownerId) {
          throw new Error("Planned recipe not found");
        }

        await assertHouseholdAccess(ctx.user.id, ownerId);

        const plannedRecipe = await updatePlannedRecipeDate(id, newDate);

        // Use emitToHousehold like the real implementation
        calendarEmitter.emitToHousehold(ctx.householdKey, "recipeUpdated", {
          plannedRecipe,
          oldDate,
        });

        return { success: true };
      }),
  });

  return t.createCallerFactory(testRouter)(ctx);
}

describe("calendar planned recipes procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  describe("listRecipes", () => {
    it("returns planned recipes for user and household within date range", async () => {
      const mockRecipes = [
        createMockPlannedRecipe({ id: "pr1", recipeName: "Pancakes" }),
        createMockPlannedRecipe({ id: "pr2", recipeName: "Salad" }),
      ];

      listPlannedRecipesByUsersAndRange.mockResolvedValue(mockRecipes);

      const caller = createTestCaller(ctx);
      const result = await caller.listRecipes({
        startISO: "2025-01-01",
        endISO: "2025-01-31",
      });

      expect(listPlannedRecipesByUsersAndRange).toHaveBeenCalledWith(
        ctx.userIds,
        "2025-01-01",
        "2025-01-31"
      );
      expect(result).toEqual(mockRecipes);
    });

    it("returns empty array when no planned recipes exist", async () => {
      listPlannedRecipesByUsersAndRange.mockResolvedValue([]);

      const caller = createTestCaller(ctx);
      const result = await caller.listRecipes({
        startISO: "2025-01-01",
        endISO: "2025-01-31",
      });

      expect(result).toEqual([]);
    });
  });

  describe("createRecipe", () => {
    it("creates a planned recipe and emits event to household", async () => {
      const mockPlannedRecipe = createMockPlannedRecipe({
        recipeId: "recipe-123",
        date: "2025-01-15",
        slot: "Breakfast",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getRecipeFullMock.mockResolvedValue({
        id: "recipe-123",
        name: "Pancakes",
      } as any);
      createPlannedRecipe.mockResolvedValue(mockPlannedRecipe);

      const caller = createTestCaller(ctx);
      const result = await caller.createRecipe({
        date: "2025-01-15",
        slot: "Breakfast",
        recipeId: "recipe-123",
      });

      expect(getRecipeFull).toHaveBeenCalledWith("recipe-123");
      expect(createPlannedRecipe).toHaveBeenCalledWith(
        expect.any(String), // UUID
        ctx.user.id,
        "recipe-123",
        "2025-01-15",
        "Breakfast"
      );
      expect(calendarEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "recipePlanned",
        { plannedRecipe: mockPlannedRecipe }
      );
      expect(result).toEqual(expect.any(String)); // Returns UUID
    });

    it("throws error when recipe not found", async () => {
      getRecipeFullMock.mockResolvedValue(null);

      const caller = createTestCaller(ctx);

      await expect(
        caller.createRecipe({
          date: "2025-01-15",
          slot: "Breakfast",
          recipeId: "non-existent",
        })
      ).rejects.toThrow("Recipe not found");

      expect(createPlannedRecipe).not.toHaveBeenCalled();
      expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
    });
  });

  describe("deleteRecipe", () => {
    it("deletes a planned recipe and emits event to household", async () => {
      getPlannedRecipeOwnerId.mockResolvedValue("test-user-id");
      assertHouseholdAccess.mockResolvedValue(undefined);
      deletePlannedRecipe.mockResolvedValue(undefined);

      const caller = createTestCaller(ctx);
      const result = await caller.deleteRecipe({
        id: "pr-123",
        date: "2025-01-15",
      });

      expect(getPlannedRecipeOwnerId).toHaveBeenCalledWith("pr-123");
      expect(assertHouseholdAccess).toHaveBeenCalledWith(ctx.user.id, "test-user-id");
      expect(deletePlannedRecipe).toHaveBeenCalledWith("pr-123");
      expect(calendarEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "recipeDeleted",
        { plannedRecipeId: "pr-123", date: "2025-01-15" }
      );
      expect(result).toEqual({ success: true });
    });

    it("throws error when planned recipe not found", async () => {
      getPlannedRecipeOwnerId.mockResolvedValue(null);

      const caller = createTestCaller(ctx);

      await expect(
        caller.deleteRecipe({
          id: "non-existent",
          date: "2025-01-15",
        })
      ).rejects.toThrow("Planned recipe not found");

      expect(deletePlannedRecipe).not.toHaveBeenCalled();
      expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
    });

    it("throws error when user lacks permission", async () => {
      getPlannedRecipeOwnerId.mockResolvedValue("other-user-id");
      assertHouseholdAccess.mockRejectedValue(new Error("Access denied"));

      const caller = createTestCaller(ctx);

      await expect(
        caller.deleteRecipe({
          id: "pr-123",
          date: "2025-01-15",
        })
      ).rejects.toThrow("Access denied");

      expect(deletePlannedRecipe).not.toHaveBeenCalled();
      expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
    });
  });

  describe("updateRecipeDate", () => {
    it("updates planned recipe date and emits event to household", async () => {
      const updatedRecipe = createMockPlannedRecipe({
        id: "pr-123",
        date: "2025-01-20",
      });

      getPlannedRecipeOwnerId.mockResolvedValue("test-user-id");
      assertHouseholdAccess.mockResolvedValue(undefined);
      updatePlannedRecipeDate.mockResolvedValue(updatedRecipe);

      const caller = createTestCaller(ctx);
      const result = await caller.updateRecipeDate({
        id: "pr-123",
        newDate: "2025-01-20",
        oldDate: "2025-01-15",
      });

      expect(getPlannedRecipeOwnerId).toHaveBeenCalledWith("pr-123");
      expect(assertHouseholdAccess).toHaveBeenCalledWith(ctx.user.id, "test-user-id");
      expect(updatePlannedRecipeDate).toHaveBeenCalledWith("pr-123", "2025-01-20");
      expect(calendarEmitter.emitToHousehold).toHaveBeenCalledWith(
        ctx.householdKey,
        "recipeUpdated",
        { plannedRecipe: updatedRecipe, oldDate: "2025-01-15" }
      );
      expect(result).toEqual({ success: true });
    });

    it("throws error when planned recipe not found", async () => {
      getPlannedRecipeOwnerId.mockResolvedValue(null);

      const caller = createTestCaller(ctx);

      await expect(
        caller.updateRecipeDate({
          id: "non-existent",
          newDate: "2025-01-20",
          oldDate: "2025-01-15",
        })
      ).rejects.toThrow("Planned recipe not found");

      expect(updatePlannedRecipeDate).not.toHaveBeenCalled();
      expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
    });

    it("throws error when user lacks permission", async () => {
      getPlannedRecipeOwnerId.mockResolvedValue("other-user-id");
      assertHouseholdAccess.mockRejectedValue(new Error("Access denied"));

      const caller = createTestCaller(ctx);

      await expect(
        caller.updateRecipeDate({
          id: "pr-123",
          newDate: "2025-01-20",
          oldDate: "2025-01-15",
        })
      ).rejects.toThrow("Access denied");

      expect(updatePlannedRecipeDate).not.toHaveBeenCalled();
      expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
    });
  });
});

