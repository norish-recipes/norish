// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trpcLogger } from "@norish/shared-server/logger";
import { plannedItemsProcedures } from "@norish/trpc/routers/calendar/planned-items";

import { assertHouseholdAccess } from "../mocks/permissions";
import {
  deletePlannedItem,
  editPlannedItem,
  getPlannedItemById,
  getPlannedItemWithRecipeById,
  listPlannedItemsWithRecipeBySlot,
  moveItem,
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

function createPlannedItem(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    userId: "test-user-id",
    date: "2025-01-15",
    slot: "Breakfast",
    sortOrder: 0,
    itemType: "note",
    recipeId: null,
    title: "Breakfast note",
    version: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("calendar planned items stale handling", () => {
  const ctx = createMockAuthedContext(createMockUser(), createMockHousehold());

  beforeEach(() => {
    vi.clearAllMocks();
    getPlannedItemById.mockResolvedValue(createPlannedItem());
    assertHouseholdAccess.mockResolvedValue(undefined);
  });

  it("logs stale moveItem mutations as no-ops", async () => {
    const item = createPlannedItem();

    getPlannedItemById.mockResolvedValue(item);
    moveItem.mockResolvedValue({ stale: true });

    const caller = plannedItemsProcedures.createCaller(ctx as any);
    const result = await caller.moveItem({
      itemId: item.id,
      version: item.version,
      targetDate: "2025-01-20",
      targetSlot: "Lunch",
      targetIndex: 1,
    });

    expect(result).toEqual({ success: true, moved: false, stale: true });
    expect(result).not.toHaveProperty("item");
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, itemId: item.id, version: item.version },
      "Ignoring stale calendar move mutation"
    );
    expect(calendar.publish).not.toHaveBeenCalled();
  });

  describe("a move to where the plan already is", () => {
    const item = createPlannedItem({ date: "2025-01-20", slot: "Lunch", sortOrder: 1 });
    const move = (version: number) =>
      plannedItemsProcedures.createCaller(ctx as any).moveItem({
        itemId: item.id,
        version,
        targetDate: "2025-01-20",
        targetSlot: "Lunch",
        targetIndex: 1,
      });

    beforeEach(() => getPlannedItemById.mockResolvedValue(item));

    it("answers stale at another version, as any write there does", async () => {
      expect(await move(item.version - 1)).toEqual({ success: true, moved: false, stale: true });
      expect(moveItem).not.toHaveBeenCalled();
    });

    it("moves nothing at its own version, and says it is not stale", async () => {
      expect(await move(item.version)).toEqual({ success: true, moved: false, stale: false });
      expect(moveItem).not.toHaveBeenCalled();
      expect(calendar.publish).not.toHaveBeenCalled();
    });
  });

  it("leaves a move with no index to the repository, which puts it last", async () => {
    const item = createPlannedItem();

    getPlannedItemById.mockResolvedValue(item);
    moveItem.mockResolvedValue({ stale: true });

    await plannedItemsProcedures.createCaller(ctx as any).moveItem({
      itemId: item.id,
      version: item.version,
      targetDate: item.date,
      targetSlot: item.slot as "Breakfast",
    });

    expect(moveItem).toHaveBeenCalledWith(item.id, item.date, item.slot, undefined, item.version);
  });

  it("logs stale deleteItem mutations as no-ops", async () => {
    const item = createPlannedItem();

    getPlannedItemById.mockResolvedValue(item);
    deletePlannedItem.mockResolvedValue({ stale: true });

    const caller = plannedItemsProcedures.createCaller(ctx as any);
    const result = await caller.deleteItem({ itemId: item.id, version: item.version });

    expect(result).toEqual({ success: true, stale: true });
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, itemId: item.id, version: item.version },
      "Ignoring stale calendar delete mutation"
    );
    expect(calendar.publish).not.toHaveBeenCalled();
  });

  it("logs stale updateItem mutations as no-ops", async () => {
    const item = createPlannedItem();

    getPlannedItemById.mockResolvedValue(item);
    editPlannedItem.mockResolvedValue({ stale: true });

    const caller = plannedItemsProcedures.createCaller(ctx as any);
    const result = await caller.updateItem({
      itemId: item.id,
      version: item.version,
      title: "Updated note",
    });

    expect(result).toEqual({ success: true, stale: true });
    expect(result).not.toHaveProperty("item");
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, itemId: item.id, version: item.version },
      "Ignoring stale calendar edit mutation"
    );
    expect(calendar.publish).not.toHaveBeenCalled();
  });

  const GONE = "00000000-0000-4000-8000-000000000001";

  describe("a plan another member removed", () => {
    beforeEach(() => getPlannedItemById.mockResolvedValue(null));
    const caller = () => plannedItemsProcedures.createCaller(createMockCallerContext(ctx));

    it("answers a move as stale", async () => {
      const result = await caller().moveItem({
        itemId: GONE,
        version: 2,
        targetDate: "2025-01-20",
        targetSlot: "Lunch",
        targetIndex: 0,
      });

      expect(result).toEqual({ success: true, moved: false, stale: true });
      expect(moveItem).not.toHaveBeenCalled();
    });

    it("answers an update as stale", async () => {
      const result = await caller().updateItem({ itemId: GONE, version: 2, title: "Soup" });

      expect(result).toEqual({ success: true, stale: true });
      expect(editPlannedItem).not.toHaveBeenCalled();
    });

    it("answers a delete as done, not stale", async () => {
      const result = await caller().deleteItem({ itemId: GONE, version: 2 });

      expect(result).toEqual({ success: true, stale: false });
      expect(deletePlannedItem).not.toHaveBeenCalled();
      expect(calendar.publish).not.toHaveBeenCalled();
    });
  });

  it("rejects an update that failed, telling no one else", async () => {
    editPlannedItem.mockRejectedValue(new Error("database down"));

    const caller = plannedItemsProcedures.createCaller(createMockCallerContext(ctx));

    await expect(caller.updateItem({ itemId: GONE, version: 4, title: "Soup" })).rejects.toThrow(
      "database down"
    );
    expect(calendar.publish).not.toHaveBeenCalled();
  });

  // The client places the answer's item in its cache, so it must be the item the echo carries.
  function publishedItem(event: string) {
    const call = calendar.publish.mock.calls.find(([name]) => name === event);

    return (call?.[1] as { item?: unknown } | undefined)?.item;
  }

  function withRecipe(item: ReturnType<typeof createPlannedItem>) {
    return { ...item, recipeName: null, recipeImage: null, servings: null, calories: null };
  }

  it("answers an applied moveItem with the item it published", async () => {
    const item = createPlannedItem();
    const moved = createPlannedItem({ ...item, date: "2025-01-20", slot: "Lunch", version: 5 });

    getPlannedItemById.mockResolvedValue(item);
    moveItem.mockResolvedValue({ stale: false, value: moved });
    getPlannedItemWithRecipeById.mockResolvedValue(withRecipe(moved));
    listPlannedItemsWithRecipeBySlot.mockResolvedValue([withRecipe(moved)]);

    const caller = plannedItemsProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.moveItem({
      itemId: item.id,
      version: item.version,
      targetDate: "2025-01-20",
      targetSlot: "Lunch",
      targetIndex: 0,
    });

    expect(publishedItem("itemMoved")).toEqual(expect.objectContaining({ version: 5 }));
    expect(result).toEqual(
      expect.objectContaining({ moved: true, item: publishedItem("itemMoved") })
    );
  });

  it("answers an applied updateItem with the item it published", async () => {
    const item = createPlannedItem();
    const updated = createPlannedItem({ ...item, title: "Updated note", version: 5 });

    getPlannedItemById.mockResolvedValue(item);
    editPlannedItem.mockResolvedValue({ stale: false, value: updated });
    getPlannedItemWithRecipeById.mockResolvedValue(withRecipe(updated));

    const caller = plannedItemsProcedures.createCaller(createMockCallerContext(ctx));
    const result = await caller.updateItem({
      itemId: item.id,
      version: item.version,
      title: "Updated note",
    });

    expect(publishedItem("itemUpdated")).toEqual(
      expect.objectContaining({ title: "Updated note", version: 5 })
    );
    expect(result).toEqual(
      expect.objectContaining({ success: true, item: publishedItem("itemUpdated") })
    );
  });
});
