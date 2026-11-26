// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPlannedRecipeProcedure,
  deletePlannedRecipeProcedure,
  listMonthPlannedRecipesProcedure,
  listPlannedRecipesRangeProcedure,
  listTodayPlannedRecipesProcedure,
  listWeekPlannedRecipesProcedure,
} from "../../src/routers/calendar/planned-items";
import { router } from "../../src/trpc";
import { policy, resetPermissionsMocks } from "../mocks/permissions";
import {
  createPlannedItem,
  deletePlannedItem,
  getPlannedItemById,
  getPlannedItemWithRecipeById,
  listPlannedItemsByHouseholdAndDateRange,
  ownPlannedItemExists,
} from "../mocks/planned-items";
import { everyRecipeIn } from "../mocks/recipes-repository";
import {
  createMockAuthedContext,
  createMockCallerContext,
  createMockHousehold,
  createMockUser,
} from "./test-utils";

vi.mock("@norish/db/repositories/planned-items", () => import("../mocks/planned-items"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/db")>()),
  getRecipeHouseholdIds: (await import("../mocks/recipes-repository")).getRecipeHouseholdIds,
}));
vi.mock("@norish/shared-server/realtime/calendar", () => import("../mocks/realtime/calendar"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));

// Every recipe a test plans is the household's own, which the policy always lets it view.
beforeEach(() => everyRecipeIn("test-household-id"));

const openApiCalendarRouter = router({
  listTodayPlannedRecipes: listTodayPlannedRecipesProcedure,
  listWeekPlannedRecipes: listWeekPlannedRecipesProcedure,
  listMonthPlannedRecipes: listMonthPlannedRecipesProcedure,
  listPlannedRecipesRange: listPlannedRecipesRangeProcedure,
  createPlannedRecipe: createPlannedRecipeProcedure,
  deletePlannedRecipe: deletePlannedRecipeProcedure,
});

describe("calendar planned recipe openapi procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists today's planned recipes only", async () => {
    listPlannedItemsByHouseholdAndDateRange.mockResolvedValue([
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

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.listTodayPlannedRecipes({});

    expect(listPlannedItemsByHouseholdAndDateRange).toHaveBeenCalledWith(
      ctx.householdId,
      "2025-01-15",
      "2025-01-15"
    );
    expect(result).toEqual([
      {
        id: expect.any(String),
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
        itemType: "recipe",
        recipeId: expect.any(String),
        title: null,
        version: 1,
        recipeName: "Omelette",
        recipeImage: null,
        servings: 2,
        calories: 250,
      },
    ]);

    const withNotes = await caller.listTodayPlannedRecipes({ include: "notes" });

    expect(withNotes.map((item) => [item.itemType, item.title])).toEqual([
      ["recipe", null],
      ["note", "Leftovers"],
    ]);
  });

  it("lists a planned recipe out of view with its title only, as the app does", async () => {
    listPlannedItemsByHouseholdAndDateRange.mockResolvedValue([
      {
        id: "5b8c3c1e-9b0a-4f1e-8a51-1f8f2b6f7a10",
        userId: ctx.user.id,
        date: "2025-01-15",
        slot: "Dinner",
        sortOrder: 0,
        itemType: "recipe",
        recipeId: null,
        title: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        recipeName: "Their stew",
        recipeImage: null,
        servings: null,
        calories: null,
      },
    ]);

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));

    expect(await caller.listTodayPlannedRecipes({})).toEqual([
      expect.objectContaining({ itemType: "recipe", recipeId: null, recipeName: "Their stew" }),
    ]);
  });

  it("lists the current week's planned recipes using server time", async () => {
    listPlannedItemsByHouseholdAndDateRange.mockResolvedValue([]);

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));
    await caller.listWeekPlannedRecipes({});

    expect(listPlannedItemsByHouseholdAndDateRange).toHaveBeenCalledWith(
      ctx.householdId,
      "2025-01-13",
      "2025-01-19"
    );
  });

  it("lists the current month's planned recipes using server time", async () => {
    listPlannedItemsByHouseholdAndDateRange.mockResolvedValue([]);

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));
    await caller.listMonthPlannedRecipes({});

    expect(listPlannedItemsByHouseholdAndDateRange).toHaveBeenCalledWith(
      ctx.householdId,
      "2025-01-01",
      "2025-01-31"
    );
  });

  it("lists planned recipes for any date range", async () => {
    listPlannedItemsByHouseholdAndDateRange.mockResolvedValue([]);

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));
    await caller.listPlannedRecipesRange({ start: "2025-02-01", end: "2025-03-15" });

    expect(listPlannedItemsByHouseholdAndDateRange).toHaveBeenCalledWith(
      ctx.householdId,
      "2025-02-01",
      "2025-03-15"
    );
  });

  it.each([
    ["a malformed date", "2025-2-1", "2025-03-01"],
    ["an impossible date", "2025-02-30", "2025-03-01"],
    ["end before start", "2025-03-02", "2025-03-01"],
    ["a range over 366 days", "2025-01-01", "2026-01-02"],
  ])("rejects %s in a range", async (_name, start, end) => {
    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));

    await expect(caller.listPlannedRecipesRange({ start, end })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it.each(["2026-13-01", "2026-00-10", "2026-01-32"])("names %s as no real date", async (start) => {
    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));

    await expect(
      caller.listPlannedRecipesRange({ start, end: "2026-12-31" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Not a real date"),
    });
  });

  it("accepts a range of exactly 366 days", async () => {
    listPlannedItemsByHouseholdAndDateRange.mockResolvedValue([]);

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));
    await caller.listPlannedRecipesRange({ start: "2024-01-01", end: "2024-12-31" });

    expect(listPlannedItemsByHouseholdAndDateRange).toHaveBeenCalled();
  });

  it("creates a planned note from a title", async () => {
    const itemId = crypto.randomUUID();
    const row = {
      id: itemId,
      userId: ctx.user.id,
      date: "2025-01-20",
      slot: "Dinner",
      sortOrder: 0,
      itemType: "note",
      recipeId: null,
      title: "Eat out",
      version: 1,
    };

    createPlannedItem.mockResolvedValue(row);
    getPlannedItemWithRecipeById.mockResolvedValue(null);

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.createPlannedRecipe({
      date: "2025-01-20",
      slot: "Dinner",
      title: "Eat out",
    });

    expect(createPlannedItem).toHaveBeenCalledWith({
      householdId: ctx.householdId,
      userId: ctx.user.id,
      date: "2025-01-20",
      slot: "Dinner",
      itemType: "note",
      recipeId: null,
      title: "Eat out",
    });
    expect(result).toEqual({ id: itemId });
  });

  it("requires exactly one of recipeId and title", async () => {
    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));
    const base = { date: "2025-01-20", slot: "Dinner" as const };

    await expect(caller.createPlannedRecipe(base)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller.createPlannedRecipe({ ...base, title: "x", recipeId: crypto.randomUUID() })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("deletes a planned note through the same route", async () => {
    const itemId = crypto.randomUUID();

    getPlannedItemById.mockResolvedValue({
      id: itemId,
      userId: ctx.user.id,
      date: "2025-01-20",
      slot: "Dinner",
      sortOrder: 0,
      itemType: "note",
      recipeId: null,
      title: "Eat out",
      version: 1,
    });
    ownPlannedItemExists.mockResolvedValue(true);
    deletePlannedItem.mockResolvedValue({ stale: false, value: {} });

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.deletePlannedRecipe({ itemId, version: 1 });

    expect(result).toEqual({ success: true, stale: false });
    expect(deletePlannedItem).toHaveBeenCalledWith(itemId, ctx.householdId, 1);
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

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.createPlannedRecipe({
      date: "2025-01-20",
      slot: "Dinner",
      recipeId,
    });

    expect(createPlannedItem).toHaveBeenCalledWith({
      householdId: ctx.householdId,
      userId: ctx.user.id,
      date: "2025-01-20",
      slot: "Dinner",
      itemType: "recipe",
      recipeId,
      title: null,
    });
    expect(result).toEqual({ id: itemId });
  });

  it("refuses to plan a recipe out of view, through the app and the API alike", async () => {
    policy.view = "household";
    everyRecipeIn("another-household");
    createPlannedItem.mockClear();

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));

    await expect(
      caller.createPlannedRecipe({
        date: "2025-01-20",
        slot: "Dinner",
        recipeId: crypto.randomUUID(),
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(createPlannedItem).not.toHaveBeenCalled();
    resetPermissionsMocks();
  });

  it("inserts a planned recipe with the client-minted id when one is supplied", async () => {
    const clientId = crypto.randomUUID();
    const recipeId = crypto.randomUUID();

    createPlannedItem.mockResolvedValue({
      id: clientId,
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
      id: clientId,
      userId: ctx.user.id,
      date: "2025-01-20",
      slot: "Dinner",
      sortOrder: 0,
      itemType: "recipe",
      recipeId,
      title: null,
      version: 1,
      recipeName: "Pasta",
      recipeImage: null,
      servings: 4,
      calories: 600,
    });

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.createPlannedRecipe({
      id: clientId,
      date: "2025-01-20",
      slot: "Dinner",
      recipeId,
    });

    expect(createPlannedItem).toHaveBeenCalledWith(expect.objectContaining({ id: clientId }));
    expect(result).toEqual({ id: clientId });
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
    ownPlannedItemExists.mockResolvedValue(true);
    deletePlannedItem.mockResolvedValue({ stale: false, value: {} });

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));
    const result = await caller.deletePlannedRecipe({ itemId, version: 2 });

    expect(result).toEqual({ success: true, stale: false });
  });

  it("answers 404 for a planned recipe that does not exist", async () => {
    getPlannedItemById.mockResolvedValue(null);

    const caller = openApiCalendarRouter.createCaller(createMockCallerContext(ctx));

    await expect(
      caller.deletePlannedRecipe({ itemId: crypto.randomUUID(), version: 1 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deletePlannedItem).not.toHaveBeenCalled();
  });
});
