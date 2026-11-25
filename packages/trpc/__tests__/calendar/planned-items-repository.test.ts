// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { db } from "@norish/db/drizzle";
import {
  getPlannedItemHouseholdId,
  listPlannedItemsBySlot,
} from "@norish/db/repositories/planned-items";

vi.mock("@norish/db/drizzle", () => ({
  db: {
    select: vi.fn(),
  },
}));

const dbMock = vi.mocked(db);

describe("planned items repository", () => {
  const householdId = "household-1";
  const date = "2025-01-10";
  const slot = "Dinner" as const;

  describe("listPlannedItemsBySlot", () => {
    it("returns items for date/slot sorted by sortOrder", async () => {
      const items = [{ id: "a" }, { id: "b" }];
      const orderBy = vi.fn().mockResolvedValue(items);
      const where = vi.fn().mockReturnValue({ orderBy });

      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({ where }),
      } as any);

      const result = await listPlannedItemsBySlot(householdId, date, slot);

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

      const result = await listPlannedItemsBySlot(householdId, date, slot);

      expect(result).toEqual([]);
    });
  });

  describe("getPlannedItemHouseholdId", () => {
    it("returns the household for the household guard", async () => {
      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ householdId: "household-1" }]),
          }),
        }),
      } as any);

      const result = await getPlannedItemHouseholdId("item-1");

      expect(result).toBe("household-1");
    });
  });
});
