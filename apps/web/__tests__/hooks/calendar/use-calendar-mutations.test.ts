import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import { createTestQueryClient, createTestWrapper } from "./test-utils";

const mockCreateItemMutate = vi.fn();
const mockDeleteItemMutate = vi.fn();
const mockMoveItemMutate = vi.fn();
const mockUpdateItemMutate = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    calendar: {
      listItems: {
        queryKey: (input: { startISO: string; endISO: string }) => ["calendar", "listItems", input],
      },
      createItem: {
        mutationOptions: (options: Record<string, unknown>) => ({
          mutationFn: mockCreateItemMutate,
          ...options,
        }),
      },
      deleteItem: {
        mutationOptions: (options: Record<string, unknown>) => ({
          mutationFn: mockDeleteItemMutate,
          ...options,
        }),
      },
      moveItem: {
        mutationOptions: (options: Record<string, unknown>) => ({
          mutationFn: mockMoveItemMutate,
          ...options,
        }),
      },
      updateItem: {
        mutationOptions: (options: Record<string, unknown>) => ({
          mutationFn: mockUpdateItemMutate,
          ...options,
        }),
      },
    },
  }),
}));

import { useCalendarMutations } from "@/hooks/calendar/use-calendar-mutations";

type PlannedItemFromQuery = {
  id: string;
  userId: string;
  date: string;
  slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
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

describe("useCalendarMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  const startISO = "2025-01-01";
  const endISO = "2025-01-31";

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  function getQueryKey() {
    return ["calendar", "listItems", { startISO, endISO }];
  }

  describe("createItem", () => {
    it("calls mutation with correct parameters", async () => {
      mockCreateItemMutate.mockResolvedValue({ id: "new-item-1" });

      const { result } = renderHook(() => useCalendarMutations(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.createItem("2025-01-15", "Breakfast", "recipe", "recipe-123");
      });

      await waitFor(() => {
        expect(mockCreateItemMutate).toHaveBeenCalled();
        expect(mockCreateItemMutate.mock.calls[0][0]).toEqual({
          date: "2025-01-15",
          slot: "Breakfast",
          itemType: "recipe",
          recipeId: "recipe-123",
          title: undefined,
        });
      });
    });

    it("calls mutation for note with title", async () => {
      mockCreateItemMutate.mockResolvedValue({ id: "new-note-1" });

      const { result } = renderHook(() => useCalendarMutations(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.createItem("2025-01-15", "Lunch", "note", undefined, "Meal prep");
      });

      await waitFor(() => {
        expect(mockCreateItemMutate).toHaveBeenCalled();
        expect(mockCreateItemMutate.mock.calls[0][0]).toEqual({
          date: "2025-01-15",
          slot: "Lunch",
          itemType: "note",
          recipeId: undefined,
          title: "Meal prep",
        });
      });
    });
  });

  describe("deleteItem", () => {
    it("applies optimistic update removing item from cache", async () => {
      const item1 = createMockItem({ id: "item-1" });
      const item2 = createMockItem({ id: "item-2" });

      queryClient.setQueryData(getQueryKey(), [item1, item2]);

      mockDeleteItemMutate.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useCalendarMutations(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.deleteItem("item-1");
      });

      await waitFor(() => {
        const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());

        expect(data).toHaveLength(1);
        expect(data![0].id).toBe("item-2");
      });

      expect(mockDeleteItemMutate).toHaveBeenCalled();
      expect(mockDeleteItemMutate.mock.calls[0][0]).toEqual({ itemId: "item-1" });
    });

    it("reverts optimistic update on error", async () => {
      const item1 = createMockItem({ id: "item-1" });

      queryClient.setQueryData(getQueryKey(), [item1]);

      mockDeleteItemMutate.mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useCalendarMutations(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.deleteItem("item-1");
      });

      await waitFor(() => {
        const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());

        expect(data).toHaveLength(1);
        expect(data![0].id).toBe("item-1");
      });
    });
  });

  describe("moveItem", () => {
    it("applies optimistic update for same-slot reorder", async () => {
      const item1 = createMockItem({ id: "item-1", sortOrder: 0 });
      const item2 = createMockItem({ id: "item-2", sortOrder: 1 });

      queryClient.setQueryData(getQueryKey(), [item1, item2]);

      mockMoveItemMutate.mockResolvedValue({ success: true, moved: true });

      const { result } = renderHook(() => useCalendarMutations(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.moveItem("item-2", "2025-01-15", "Breakfast", 0);
      });

      await waitFor(() => {
        const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());
        const movedItem = data!.find((i) => i.id === "item-2");

        expect(movedItem?.sortOrder).toBe(0);
      });

      expect(mockMoveItemMutate).toHaveBeenCalled();
      expect(mockMoveItemMutate.mock.calls[0][0]).toEqual({
        itemId: "item-2",
        targetDate: "2025-01-15",
        targetSlot: "Breakfast",
        targetIndex: 0,
      });
    });

    it("applies optimistic update for cross-slot move", async () => {
      const breakfastItem = createMockItem({ id: "b-1", slot: "Breakfast", sortOrder: 0 });
      const lunchItem = createMockItem({ id: "l-1", slot: "Lunch", sortOrder: 0 });

      queryClient.setQueryData(getQueryKey(), [breakfastItem, lunchItem]);

      mockMoveItemMutate.mockResolvedValue({ success: true, moved: true });

      const { result } = renderHook(() => useCalendarMutations(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.moveItem("b-1", "2025-01-15", "Lunch", 1);
      });

      await waitFor(() => {
        const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());
        const movedItem = data!.find((i) => i.id === "b-1");

        expect(movedItem?.slot).toBe("Lunch");
        expect(movedItem?.sortOrder).toBe(1);
      });
    });

    it("applies optimistic update for cross-date move", async () => {
      const item = createMockItem({ id: "item-1", date: "2025-01-15", sortOrder: 0 });

      queryClient.setQueryData(getQueryKey(), [item]);

      mockMoveItemMutate.mockResolvedValue({ success: true, moved: true });

      const { result } = renderHook(() => useCalendarMutations(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.moveItem("item-1", "2025-01-20", "Dinner", 0);
      });

      await waitFor(() => {
        const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());
        const movedItem = data!.find((i) => i.id === "item-1");

        expect(movedItem?.date).toBe("2025-01-20");
        expect(movedItem?.slot).toBe("Dinner");
      });
    });

    it("reverts optimistic update on error", async () => {
      const item = createMockItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      queryClient.setQueryData(getQueryKey(), [item]);

      mockMoveItemMutate.mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useCalendarMutations(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.moveItem("item-1", "2025-01-20", "Dinner", 0);
      });

      await waitFor(() => {
        const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());
        const item = data!.find((i) => i.id === "item-1");

        expect(item?.date).toBe("2025-01-15");
        expect(item?.slot).toBe("Breakfast");
      });
    });
  });

  describe("loading states", () => {
    it("tracks isCreating state", async () => {
      let resolvePromise: (value: unknown) => void;

      mockCreateItemMutate.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      const { result } = renderHook(() => useCalendarMutations(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isCreating).toBe(false);

      act(() => {
        result.current.createItem("2025-01-15", "Breakfast", "recipe", "recipe-123");
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(true);
      });

      act(() => {
        resolvePromise!({ id: "new-id" });
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(false);
      });
    });

    it("tracks isDeleting state", async () => {
      let resolvePromise: (value: unknown) => void;

      mockDeleteItemMutate.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      const { result } = renderHook(() => useCalendarMutations(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isDeleting).toBe(false);

      act(() => {
        result.current.deleteItem("item-1");
      });

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(true);
      });

      act(() => {
        resolvePromise!({ success: true });
      });

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });
    });

    it("tracks isMoving state", async () => {
      let resolvePromise: (value: unknown) => void;

      mockMoveItemMutate.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          })
      );

      const { result } = renderHook(() => useCalendarMutations(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isMoving).toBe(false);

      act(() => {
        result.current.moveItem("item-1", "2025-01-20", "Dinner", 0);
      });

      await waitFor(() => {
        expect(result.current.isMoving).toBe(true);
      });

      act(() => {
        resolvePromise!({ success: true, moved: true });
      });

      await waitFor(() => {
        expect(result.current.isMoving).toBe(false);
      });
    });
  });
});
