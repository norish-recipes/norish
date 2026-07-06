// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { plannedItemsProcedures } from "@norish/trpc/routers/calendar/planned-items";

import { calendarEmitter } from "../mocks/calendar-emitter";
import {
  createPlannedItem,
  getPlannedItemWithRecipeById,
  listPlannedItemsByUserAndDateRange,
} from "../mocks/planned-items";
import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

vi.mock("@norish/db/repositories/planned-items", () => import("../mocks/planned-items"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/calendar/emitter", () => import("../mocks/calendar-emitter"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

function createPlannedItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    userId: "test-user-id",
    date: "2026-05-22",
    slot: "Breakfast",
    sortOrder: 0,
    itemType: "recipe",
    recipeId: "11111111-1111-4111-8111-111111111111",
    title: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    recipeName: "Omelette",
    recipeImage: "/recipes/omelette.jpg",
    servings: 2,
    calories: 320,
    ...overrides,
  };
}

describe("calendar planned items household events", () => {
  const ctx = createMockAuthedContext(createMockUser(), createMockHousehold());
  const createCaller = () =>
    plannedItemsProcedures.createCaller({
      ...ctx,
      multiplexer: null,
      operationId: null,
    } as Parameters<typeof plannedItemsProcedures.createCaller>[0]);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists planned items for all household users in the requested range", async () => {
    const item = createPlannedItemRow({ userId: "household-member-id" });

    listPlannedItemsByUserAndDateRange.mockResolvedValue([item]);

    const caller = createCaller();
    const result = await caller.listItems({
      startISO: "2026-05-22",
      endISO: "2026-05-22",
    });

    expect(listPlannedItemsByUserAndDateRange).toHaveBeenCalledWith(
      ctx.userIds,
      "2026-05-22",
      "2026-05-22"
    );
    expect(result).toEqual([item]);
  });

  it("emits created planned items to the household with recipe metadata", async () => {
    const item = createPlannedItemRow({ userId: ctx.user.id });

    createPlannedItem.mockResolvedValue(item);
    getPlannedItemWithRecipeById.mockResolvedValue(item);

    const caller = createCaller();
    const result = await caller.createItem({
      date: "2026-05-22",
      slot: "Breakfast",
      itemType: "recipe",
      recipeId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result).toEqual({ id: item.id });
    expect(createPlannedItem).toHaveBeenCalledWith({
      userId: ctx.user.id,
      date: "2026-05-22",
      slot: "Breakfast",
      itemType: "recipe",
      recipeId: "11111111-1111-4111-8111-111111111111",
      title: null,
    });
    expect(calendarEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "itemCreated", {
      item: expect.objectContaining({
        id: item.id,
        userId: ctx.user.id,
        recipeName: "Omelette",
        recipeImage: "/recipes/omelette.jpg",
        servings: 2,
        calories: 320,
      }),
    });
  });
});
