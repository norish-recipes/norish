// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { plannedItemsProcedures } from "@norish/trpc/routers/calendar/planned-items";

import {
  editPlannedItem,
  getPlannedItemById,
  getPlannedItemWithRecipeById,
  listPlannedItemsWithRecipeBySlot,
  ownPlannedItemExists,
} from "../mocks/planned-items";
import { calendar } from "../mocks/realtime/calendar";
import {
  createMockAuthedContext,
  createMockCallerContext,
  createMockHousehold,
  createMockUser,
} from "./test-utils";

vi.mock("@norish/db/repositories/planned-items", () => import("../mocks/planned-items"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/realtime/calendar", () => import("../mocks/realtime/calendar"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const ID = "00000000-0000-4000-8000-000000000001";
const stored = {
  id: ID,
  householdId: "test-household-id",
  userId: "household-member-id",
  date: "2025-01-15",
  slot: "Dinner",
  sortOrder: 0,
  itemType: "note",
  recipeId: null,
  title: "Soup",
  version: 4,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const withRecipe = (row: object) => ({
  ...stored,
  ...row,
  recipeName: null,
  recipeImage: null,
  servings: null,
  calories: null,
});

// The fields an edit names: the router passes the others as undefined.
const named = (change: object) =>
  Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined));

describe("calendar.editItem", () => {
  const ctx = createMockAuthedContext(createMockUser(), createMockHousehold());
  const edit = (input: { version?: number; title?: string; date?: string; slot?: "Lunch" }) =>
    plannedItemsProcedures
      .createCaller(createMockCallerContext(ctx))
      .editItem({ itemId: ID, version: stored.version, ...input });
  const published = () => calendar.publish.mock.calls.map(([event]) => event);

  beforeEach(() => {
    vi.clearAllMocks();
    ownPlannedItemExists.mockResolvedValue(true);
    getPlannedItemById.mockResolvedValue(stored);
    listPlannedItemsWithRecipeBySlot.mockResolvedValue([]);
    editPlannedItem.mockImplementation(async (_household, _id, change: object) => ({
      applied: true,
      stale: false,
      value: { ...stored, ...named(change), version: stored.version + 1 },
    }));
    getPlannedItemWithRecipeById.mockImplementation(async () => {
      const [, , change = {}] = editPlannedItem.mock.calls[0] ?? [];

      return withRecipe({ ...named(change), version: stored.version + 1 });
    });
  });

  it.each([
    ["title only", { title: "Leek soup" }, "itemUpdated"],
    ["date only", { date: "2025-01-16" }, "itemMoved"],
    ["slot only", { slot: "Lunch" as const }, "itemMoved"],
    ["date and slot", { date: "2025-01-16", slot: "Lunch" as const }, "itemMoved"],
    ["title and date", { title: "Leek soup", date: "2025-01-16" }, "itemMoved"],
    ["all three", { title: "Leek soup", date: "2025-01-16", slot: "Lunch" as const }, "itemMoved"],
  ])("%s: one repository write, one event, the item in the answer", async (_, change, event) => {
    const result = await edit(change);

    expect(editPlannedItem).toHaveBeenCalledTimes(1);
    expect(editPlannedItem).toHaveBeenCalledWith(ctx.householdId, ID, change, stored.version);
    expect(published()).toEqual([event, `${event}Internal`]);
    expect(result).toEqual({
      success: true,
      stale: false,
      item: expect.objectContaining({ ...change, version: stored.version + 1 }),
    });
  });

  it("a move tells the household both slots' order", async () => {
    await edit({ slot: "Lunch" });

    expect(listPlannedItemsWithRecipeBySlot).toHaveBeenCalledWith(
      ctx.householdId,
      stored.date,
      "Lunch"
    );
    expect(listPlannedItemsWithRecipeBySlot).toHaveBeenCalledWith(
      ctx.householdId,
      stored.date,
      "Dinner"
    );
    expect(calendar.publish.mock.calls[0]?.[1]).toMatchObject({
      oldDate: stored.date,
      oldSlot: "Dinner",
      item: { slot: "Lunch" },
    });
  });

  it("nothing, or only what it already is: writes nothing and tells no one", async () => {
    expect(await edit({})).toEqual({ success: true, stale: false });
    expect(await edit({ date: stored.date })).toEqual({ success: true, stale: false });
    expect(editPlannedItem).not.toHaveBeenCalled();
    expect(calendar.publish).not.toHaveBeenCalled();
  });

  it("at another version refuses the whole edit", async () => {
    const result = await edit({ version: 3, title: "Leek soup", date: "2025-01-16" });

    expect(result).toEqual({ success: true, stale: true });
    expect(editPlannedItem).not.toHaveBeenCalled();
    expect(calendar.publish).not.toHaveBeenCalled();
  });

  it("is stale when the repository finds the version moved on", async () => {
    editPlannedItem.mockResolvedValue({ applied: false, stale: true });

    expect(await edit({ title: "Leek soup", slot: "Lunch" })).toEqual({
      success: true,
      stale: true,
    });
    expect(calendar.publish).not.toHaveBeenCalled();
  });

  it("is stale for a removed item", async () => {
    getPlannedItemById.mockResolvedValue(null);

    expect(await edit({ title: "Leek soup" })).toEqual({ success: true, stale: true });
    expect(editPlannedItem).not.toHaveBeenCalled();
  });

  it("refuses a day that is not a date key, writing nothing", async () => {
    await expect(edit({ date: "tomorrow" })).rejects.toThrow();
    expect(editPlannedItem).not.toHaveBeenCalled();
  });
});
