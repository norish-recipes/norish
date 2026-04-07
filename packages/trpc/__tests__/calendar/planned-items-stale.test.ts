// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trpcLogger } from "@norish/shared-server/logger";
import { plannedItemsProcedures } from "@norish/trpc/routers/calendar/planned-items";

import { calendarEmitter } from "../mocks/calendar-emitter";
import { assertHouseholdAccess } from "../mocks/permissions";
import {
  deletePlannedItem,
  getPlannedItemById,
  moveItem,
  updatePlannedItem,
} from "../mocks/planned-items";
import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

vi.mock("@norish/db/repositories/planned-items", () => import("../mocks/planned-items"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/calendar/emitter", () => import("../mocks/calendar-emitter"));
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

    const caller = plannedItemsProcedures.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.moveItem({
      itemId: item.id,
      version: item.version,
      targetDate: "2025-01-20",
      targetSlot: "Lunch",
      targetIndex: 1,
    });

    expect(result).toEqual({ success: true, moved: false, stale: true });
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, itemId: item.id, version: item.version },
      "Ignoring stale calendar move mutation"
    );
    expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
  });

  it("logs stale deleteItem mutations as no-ops", async () => {
    const item = createPlannedItem();

    getPlannedItemById.mockResolvedValue(item);
    deletePlannedItem.mockResolvedValue({ stale: true });

    const caller = plannedItemsProcedures.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.deleteItem({ itemId: item.id, version: item.version });

    expect(result).toEqual({ success: true, stale: true });
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, itemId: item.id, version: item.version },
      "Ignoring stale calendar delete mutation"
    );
    expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
  });

  it("logs stale updateItem mutations as no-ops", async () => {
    const item = createPlannedItem();

    getPlannedItemById.mockResolvedValue(item);
    updatePlannedItem.mockResolvedValue({ stale: true });

    const caller = plannedItemsProcedures.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.updateItem({
      itemId: item.id,
      version: item.version,
      title: "Updated note",
    });

    expect(result).toEqual({ success: true, stale: true });
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, itemId: item.id, version: item.version },
      "Ignoring stale calendar update mutation"
    );
    expect(calendarEmitter.emitToHousehold).not.toHaveBeenCalled();
  });
});
