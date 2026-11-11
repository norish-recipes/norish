import { parseContainerId, useCalendarDnd } from "@/hooks/calendar/use-calendar-dnd";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

type Slot = "Breakfast" | "Lunch" | "Dinner" | "Snack";

type PlannedItemFromQuery = {
  id: string;
  userId: string;
  date: string;
  slot: Slot;
  sortOrder: number;
  itemType: "recipe" | "note";
  recipeId: string | null;
  title: string | null;
  recipeName: string | null;
  recipeImage: string | null;
  servings: number | null;
  calories: number | null;
  createdAt: Date;
  updatedAt: Date;
};

vi.mock("@norish/shared-react/calendar", () => ({
  useCalendarRange: (select: (state: unknown) => unknown) =>
    select({ range: { startISO: "2025-01-01", endISO: "2025-01-31" } }),
  useCalendarQuery: () => ({ calendarData: mockPlannedItemsByDate }),
  useCalendarMutations: () => ({ moveItem: mockMoveItem }),
}));

let mockPlannedItemsByDate: Record<string, PlannedItemFromQuery[]> = {};
const mockMoveItem = vi.fn();

function createMockItem(overrides: Partial<PlannedItemFromQuery> = {}): PlannedItemFromQuery {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    userId: "user-1",
    date: "2025-01-15",
    slot: "Breakfast",
    sortOrder: 0,
    itemType: "recipe",
    recipeId: "recipe-123",
    title: null,
    recipeName: "Test Recipe",
    recipeImage: null,
    servings: 4,
    calories: 500,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Calendar DnD Integration", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockPlannedItemsByDate = {};
  });

  describe("parseContainerId", () => {
    it("parses valid container ID", () => {
      const result = parseContainerId("2025-01-15_Breakfast");

      expect(result).toEqual({ date: "2025-01-15", slot: "Breakfast" });
    });

    it("handles dates with underscores", () => {
      const result = parseContainerId("2025_01_15_Lunch");

      expect(result).toEqual({ date: "2025_01_15", slot: "Lunch" });
    });

    it("returns null for invalid ID", () => {
      const result = parseContainerId("invalid");

      expect(result).toBeNull();
    });
  });

  describe("useCalendarDnd hook", () => {
    it("derives items from plannedItemsByDate via useMemo", () => {
      const item1 = createMockItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });
      const item2 = createMockItem({
        id: "item-2",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 1,
      });
      const item3 = createMockItem({
        id: "item-3",
        date: "2025-01-15",
        slot: "Lunch",
        sortOrder: 0,
      });

      mockPlannedItemsByDate = {
        "2025-01-15": [item1, item2, item3],
      };

      const { result } = renderHook(() => useCalendarDnd(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.items["2025-01-15_Breakfast"]).toEqual(["item-1", "item-2"]);
      expect(result.current.items["2025-01-15_Lunch"]).toEqual(["item-3"]);
    });

    it("sorts items by sortOrder", () => {
      const item1 = createMockItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 2,
      });
      const item2 = createMockItem({
        id: "item-2",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });
      const item3 = createMockItem({
        id: "item-3",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 1,
      });

      mockPlannedItemsByDate = {
        "2025-01-15": [item1, item2, item3],
      };

      const { result } = renderHook(() => useCalendarDnd(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.items["2025-01-15_Breakfast"]).toEqual(["item-2", "item-3", "item-1"]);
    });

    it("getItemsForContainer returns items for a slot", () => {
      const item1 = createMockItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      mockPlannedItemsByDate = {
        "2025-01-15": [item1],
      };

      const { result } = renderHook(() => useCalendarDnd(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.getItemsForContainer("2025-01-15_Breakfast")).toEqual(["item-1"]);
      expect(result.current.getItemsForContainer("2025-01-15_Lunch")).toEqual([]);
    });

    it("getItemById returns item by ID", () => {
      const item1 = createMockItem({ id: "item-1", recipeName: "Pancakes" });

      mockPlannedItemsByDate = {
        "2025-01-15": [item1],
      };

      const { result } = renderHook(() => useCalendarDnd(), {
        wrapper: createTestWrapper(queryClient),
      });

      const foundItem = result.current.getItemById("item-1");

      expect(foundItem?.recipeName).toBe("Pancakes");
      expect(result.current.getItemById("nonexistent")).toBeUndefined();
    });

    it("activeId is null initially", () => {
      mockPlannedItemsByDate = {};

      const { result } = renderHook(() => useCalendarDnd(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.activeId).toBeNull();
      expect(result.current.activeItem).toBeNull();
    });
  });

  describe("Drag operations", () => {
    it("handleDragStart sets activeId and clones items", () => {
      const item1 = createMockItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      mockPlannedItemsByDate = {
        "2025-01-15": [item1],
      };

      const { result } = renderHook(() => useCalendarDnd(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.handleDragStart({
          active: {
            id: "item-1",
            data: { current: {} },
            rect: { current: { initial: null, translated: null } },
          },
        } as any);
      });

      expect(result.current.activeId).toBe("item-1");
      expect(result.current.activeItem?.id).toBe("item-1");
    });

    it("handleDragCancel resets state", () => {
      const item1 = createMockItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      mockPlannedItemsByDate = {
        "2025-01-15": [item1],
      };

      const { result } = renderHook(() => useCalendarDnd(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.handleDragStart({
          active: {
            id: "item-1",
            data: { current: {} },
            rect: { current: { initial: null, translated: null } },
          },
        } as any);
      });

      expect(result.current.activeId).toBe("item-1");

      act(() => {
        result.current.handleDragCancel();
      });

      expect(result.current.activeId).toBeNull();
    });

    it("handleDragEnd calls moveItem for cross-slot moves", () => {
      const item1 = createMockItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      mockPlannedItemsByDate = {
        "2025-01-15": [item1],
      };

      const { result } = renderHook(() => useCalendarDnd(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.handleDragStart({
          active: {
            id: "item-1",
            data: { current: {} },
            rect: { current: { initial: null, translated: null } },
          },
        } as any);
      });

      act(() => {
        result.current.handleDragOver({
          active: {
            id: "item-1",
            data: { current: {} },
            rect: {
              current: { initial: null, translated: { top: 100, left: 0, width: 100, height: 50 } },
            },
          },
          over: {
            id: "2025-01-15_Lunch",
            data: { current: {} },
            rect: { top: 50, left: 0, width: 100, height: 50 },
          },
        } as any);
      });

      act(() => {
        result.current.handleDragEnd({
          active: {
            id: "item-1",
            data: { current: {} },
            rect: { current: { initial: null, translated: null } },
          },
          over: {
            id: "2025-01-15_Lunch",
            data: { current: {} },
            rect: { top: 50, left: 0, width: 100, height: 50 },
          },
        } as any);
      });

      expect(mockMoveItem).toHaveBeenCalledWith("item-1", "2025-01-15", "Lunch", 0);
    });

    it("handleDragEnd does not call moveItem when dropped in same position", () => {
      const item1 = createMockItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      mockPlannedItemsByDate = {
        "2025-01-15": [item1],
      };

      const { result } = renderHook(() => useCalendarDnd(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.handleDragStart({
          active: {
            id: "item-1",
            data: { current: {} },
            rect: { current: { initial: null, translated: null } },
          },
        } as any);
      });

      act(() => {
        result.current.handleDragEnd({
          active: {
            id: "item-1",
            data: { current: {} },
            rect: { current: { initial: null, translated: null } },
          },
          over: {
            id: "item-1",
            data: { current: {} },
            rect: { top: 0, left: 0, width: 100, height: 50 },
          },
        } as any);
      });

      expect(mockMoveItem).not.toHaveBeenCalled();
    });
  });

  describe("Cross-day moves", () => {
    it("handles moving item to different day", () => {
      const item1 = createMockItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      mockPlannedItemsByDate = {
        "2025-01-15": [item1],
        "2025-01-16": [],
      };

      const { result } = renderHook(() => useCalendarDnd(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.handleDragStart({
          active: {
            id: "item-1",
            data: { current: {} },
            rect: { current: { initial: null, translated: null } },
          },
        } as any);
      });

      act(() => {
        result.current.handleDragOver({
          active: {
            id: "item-1",
            data: { current: {} },
            rect: {
              current: { initial: null, translated: { top: 100, left: 0, width: 100, height: 50 } },
            },
          },
          over: {
            id: "2025-01-16_Dinner",
            data: { current: {} },
            rect: { top: 50, left: 0, width: 100, height: 50 },
          },
        } as any);
      });

      act(() => {
        result.current.handleDragEnd({
          active: {
            id: "item-1",
            data: { current: {} },
            rect: { current: { initial: null, translated: null } },
          },
          over: {
            id: "2025-01-16_Dinner",
            data: { current: {} },
            rect: { top: 50, left: 0, width: 100, height: 50 },
          },
        } as any);
      });

      expect(mockMoveItem).toHaveBeenCalledWith("item-1", "2025-01-16", "Dinner", 0);
    });
  });

  describe("Reorder within slot", () => {
    it("updates items during drag over within same slot", () => {
      const item1 = createMockItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });
      const item2 = createMockItem({
        id: "item-2",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 1,
      });
      const item3 = createMockItem({
        id: "item-3",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 2,
      });

      mockPlannedItemsByDate = {
        "2025-01-15": [item1, item2, item3],
      };

      const { result } = renderHook(() => useCalendarDnd(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.items["2025-01-15_Breakfast"]).toEqual(["item-1", "item-2", "item-3"]);

      act(() => {
        result.current.handleDragStart({
          active: {
            id: "item-3",
            data: { current: {} },
            rect: { current: { initial: null, translated: null } },
          },
        } as any);
      });

      act(() => {
        result.current.handleDragOver({
          active: {
            id: "item-3",
            data: { current: {} },
            rect: {
              current: { initial: null, translated: { top: 10, left: 0, width: 100, height: 50 } },
            },
          },
          over: {
            id: "item-1",
            data: { current: {} },
            rect: { top: 50, left: 0, width: 100, height: 50 },
          },
        } as any);
      });

      expect(result.current.items["2025-01-15_Breakfast"]).toEqual(["item-3", "item-1", "item-2"]);
    });
  });
});
