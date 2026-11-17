// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { db } from "@norish/db/drizzle";
import {
  getPlannedItemOwnerId,
  listPlannedItemsBySlot,
  listPlannedItemsByUserAndDateRange,
} from "@norish/db/repositories/planned-items";

vi.mock("@norish/db/drizzle", () => ({
  db: {
    select: vi.fn(),
  },
}));

const dbMock = vi.mocked(db);

describe("planned items repository", () => {
  const userIds = ["user-1", "user-2"];
  const date = "2025-01-10";
  const slot = "Dinner" as const;

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
