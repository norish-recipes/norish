// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/drizzle", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

import { db } from "@/server/db/drizzle";
import { plannedItems } from "@/server/db/schema/planned-items";
import {
  createPlannedItem,
  deletePlannedItem,
  getMaxSortOrder,
  getPlannedItemOwnerId,
  listPlannedItemsBySlot,
  listPlannedItemsByUserAndDateRange,
  moveItem,
  updatePlannedItem,
} from "@/server/db/repositories/planned-items";

const dbMock = vi.mocked(db);

describe("planned items repository", () => {
  const userIds = ["user-1", "user-2"];
  const date = "2025-01-10";
  const slot = "Dinner" as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listPlannedItemsByUserAndDateRange", () => {
    it("returns items sorted by date, slot, sortOrder", async () => {
      const items = [{ id: "a" }, { id: "b" }];
      const orderBy = vi.fn().mockResolvedValue(items);
      const where = vi.fn().mockReturnValue({ orderBy });
      const leftJoin = vi.fn().mockReturnValue({ where });

      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({ leftJoin }),
      } as any);

      const result = await listPlannedItemsByUserAndDateRange(userIds, "2025-01-01", "2025-01-31");

      expect(dbMock.select).toHaveBeenCalled();
      expect(leftJoin).toHaveBeenCalled();
      expect(where).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalled();
      expect(result).toEqual(items);
    });

    it("returns empty array for no matches", async () => {
      const orderBy = vi.fn().mockResolvedValue([]);
      const where = vi.fn().mockReturnValue({ orderBy });
      const leftJoin = vi.fn().mockReturnValue({ where });

      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({ leftJoin }),
      } as any);

      const result = await listPlannedItemsByUserAndDateRange(userIds, "2025-01-01", "2025-01-31");

      expect(result).toEqual([]);
    });
  });

  describe("listPlannedItemsBySlot", () => {
    it("returns items for date/slot sorted by sortOrder", async () => {
      const items = [{ id: "a" }, { id: "b" }];
      const orderBy = vi.fn().mockResolvedValue(items);
      const where = vi.fn().mockReturnValue({ orderBy });

      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({ where }),
      } as any);

      const result = await listPlannedItemsBySlot(userIds, date, slot);

      expect(where).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalled();
      expect(result).toEqual(items);
    });

    it("returns empty array when no items", async () => {
      const orderBy = vi.fn().mockResolvedValue([]);
      const where = vi.fn().mockReturnValue({ orderBy });

      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({ where }),
      } as any);

      const result = await listPlannedItemsBySlot(userIds, date, slot);

      expect(result).toEqual([]);
    });
  });

  describe("createPlannedItem", () => {
    it("inserts item with sortOrder = max + 1", async () => {
      const input = { userId: "user-1", date, slot, itemType: "note", title: "Note" };
      const returning = vi.fn().mockResolvedValue([{ id: "new-item" }]);
      const values = vi.fn().mockReturnValue({ returning });

      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ max: 2 }]),
        }),
      } as any);
      dbMock.insert.mockReturnValue({ values } as any);

      const result = await createPlannedItem(input as any);

      expect(values).toHaveBeenCalledWith({ ...input, sortOrder: 3 });
      expect(result).toEqual({ id: "new-item" });
    });

    it("first item in slot gets sortOrder = 0", async () => {
      const input = { userId: "user-1", date, slot, itemType: "note", title: "Note" };
      const returning = vi.fn().mockResolvedValue([{ id: "new-item" }]);
      const values = vi.fn().mockReturnValue({ returning });

      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ max: null }]),
        }),
      } as any);
      dbMock.insert.mockReturnValue({ values } as any);

      const result = await createPlannedItem(input as any);

      expect(values).toHaveBeenCalledWith({ ...input, sortOrder: 0 });
      expect(result).toEqual({ id: "new-item" });
    });
  });

  describe("updatePlannedItem", () => {
    it("updates item fields atomically", async () => {
      const updates = { title: "Updated" };
      const returning = vi.fn().mockResolvedValue([{ id: "item-1", title: "Updated" }]);
      const set = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) });

      dbMock.update.mockReturnValue({ set } as any);

      const result = await updatePlannedItem("item-1", updates as any);

      expect(dbMock.update).toHaveBeenCalledWith(plannedItems);
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ title: "Updated" }));
      expect(result).toEqual({ id: "item-1", title: "Updated" });
    });

    it("returns null when item not found", async () => {
      const returning = vi.fn().mockResolvedValue([]);
      const set = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) });

      dbMock.update.mockReturnValue({ set } as any);

      const result = await updatePlannedItem("item-1", { title: "Updated" } as any);

      expect(result).toBeNull();
    });
  });

  describe("deletePlannedItem", () => {
    it("removes item and reindexes remaining items", async () => {
      const deleteWhere = vi.fn().mockResolvedValue(undefined);
      const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });
      const updateWhere = vi
        .fn()
        .mockReturnValueOnce({ returning: vi.fn().mockResolvedValue([{ id: "a", sortOrder: 0 }]) })
        .mockReturnValueOnce({ returning: vi.fn().mockResolvedValue([{ id: "b", sortOrder: 1 }]) });
      const updateSet = vi.fn().mockReturnValue({ where: updateWhere });

      dbMock.transaction.mockImplementation(async (callback) =>
        callback({
          delete: vi.fn().mockReturnValue({ where: deleteWhere }),
          update: vi.fn().mockReturnValue({ set: updateSet }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi
                .fn()
                .mockReturnValueOnce({
                  limit: vi.fn().mockResolvedValue([{ id: "item-1" }]),
                })
                .mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([{ id: "a" }, { id: "b" }]),
                }),
            }),
          }),
        } as any)
      );
      dbMock.delete.mockReturnValue(deleteFn as any);

      const result = await deletePlannedItem("item-1");

      expect(result).toEqual([
        { id: "a", sortOrder: 0 },
        { id: "b", sortOrder: 1 },
      ]);
      expect(deleteWhere).toHaveBeenCalled();
      expect(updateSet).toHaveBeenCalled();
      expect(updateWhere).toHaveBeenCalled();
    });
  });

  describe("moveItem", () => {
    it("moves item to new position and reindexes source and target slots", async () => {
      const plannedItem = { id: "item-1", userId: "user-1", date, slot, sortOrder: 1 };
      const returning = vi.fn().mockResolvedValue([{ ...plannedItem, date: "2025-01-12" }]);
      const set = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) });

      dbMock.transaction.mockImplementation(async (callback) =>
        callback({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi
                .fn()
                .mockReturnValueOnce({
                  limit: vi.fn().mockResolvedValue([plannedItem]),
                })
                .mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([plannedItem]),
                }),
            }),
          }),
          update: vi.fn().mockReturnValue({ set }),
        } as any)
      );

      const result = await moveItem("item-1", "2025-01-12", "Lunch", 0);

      expect(result).toEqual({ ...plannedItem, date: "2025-01-12" });
      expect(set).toHaveBeenCalled();
    });
  });

  describe("getMaxSortOrder", () => {
    it("returns highest sortOrder for date and slot", async () => {
      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ max: 4 }]),
        }),
      } as any);

      const result = await getMaxSortOrder(userIds, date, slot);

      expect(result).toBe(4);
    });

    it("returns -1 when no items", async () => {
      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await getMaxSortOrder(userIds, date, slot);

      expect(result).toBe(-1);
    });
  });

  describe("getPlannedItemOwnerId", () => {
    it("returns userId for permission checks", async () => {
      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ userId: "user-1" }]),
          }),
        }),
      } as any);

      const result = await getPlannedItemOwnerId("item-1");

      expect(result).toBe("user-1");
    });
  });
});
