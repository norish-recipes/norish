import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

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

const mockMoveItemMutate = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    calendar: {
      listItems: {
        queryKey: (input: { startISO: string; endISO: string }) => ["calendar", "listItems", input],
        queryOptions: () => ({
          queryKey: ["calendar", "listItems", { startISO: "2025-01-01", endISO: "2025-01-31" }],
          queryFn: async () => [],
        }),
      },
      createItem: {
        mutationOptions: (options: Record<string, unknown>) => ({
          mutationFn: vi.fn(),
          ...options,
        }),
      },
      deleteItem: {
        mutationOptions: (options: Record<string, unknown>) => ({
          mutationFn: vi.fn(),
          ...options,
        }),
      },
      moveItem: {
        mutationOptions: (options: Record<string, unknown>) => ({
          mutationFn: mockMoveItemMutate,
          ...options,
        }),
      },
      onItemCreated: {
        subscriptionOptions: () => ({ enabled: true }),
      },
      onItemDeleted: {
        subscriptionOptions: () => ({ enabled: true }),
      },
      onItemMoved: {
        subscriptionOptions: () => ({ enabled: true }),
      },
      onFailed: {
        subscriptionOptions: () => ({ enabled: true }),
      },
    },
  }),
}));

vi.mock("@trpc/tanstack-react-query", () => ({
  useSubscription: vi.fn(),
}));

vi.mock("@/app/(app)/calendar/context", () => ({
  useCalendarContext: () => ({
    plannedItemsByDate: mockPlannedItemsByDate,
    moveItem: mockContextMoveItem,
  }),
}));

let mockPlannedItemsByDate: Record<string, PlannedItemFromQuery[]> = {};
const mockContextMoveItem = vi.fn();

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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function createTestWrapper(queryClient: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

import { useCalendarDnd, parseContainerId } from "@/hooks/calendar/use-calendar-dnd";

describe("Calendar DnD Integration", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
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

      expect(mockContextMoveItem).toHaveBeenCalledWith("item-1", "2025-01-15", "Lunch", 0);
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

      expect(mockContextMoveItem).not.toHaveBeenCalled();
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

      expect(mockContextMoveItem).toHaveBeenCalledWith("item-1", "2025-01-16", "Dinner", 0);
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
