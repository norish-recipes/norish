import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { applyMoveEchoInRange } from "../calendar-cache-merge";
import { useCalendarMutations } from "../use-calendar-mutations";

const mockCreateItemMutate = vi.fn();
const mockDeleteItemMutate = vi.fn();
const mockMoveItemMutate = vi.fn();
const mockUpdateItemMutate = vi.fn();

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    calendar: {
      listItems: {
        // The shape tRPC mints, which the cross-range writes read the range back from.
        queryKey: (input?: { startISO: string; endISO: string }) =>
          input
            ? [["calendar", "listItems"], { input, type: "query" }]
            : [["calendar", "listItems"]],
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
  version: number;
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
    version: 1,
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
    queryClient = createTestQueryClient();
  });

  function getQueryKey() {
    return [["calendar", "listItems"], { input: { startISO, endISO }, type: "query" }];
  }

  describe("planRecipe and planNote", () => {
    it("calls mutation with correct parameters", async () => {
      mockCreateItemMutate.mockResolvedValue({ id: "new-item-1" });

      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.planRecipe("2025-01-15", "Breakfast", "recipe-123");
      });

      await waitFor(() => {
        expect(mockCreateItemMutate).toHaveBeenCalled();
        expect(mockCreateItemMutate.mock.calls[0]![0]).toEqual({
          // Client-minted id (ADR-0003).
          id: expect.any(String),
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

      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.planNote("2025-01-15", "Lunch", "Meal prep");
      });

      await waitFor(() => {
        expect(mockCreateItemMutate).toHaveBeenCalled();
        expect(mockCreateItemMutate.mock.calls[0]![0]).toEqual({
          // Client-minted id (ADR-0003).
          id: expect.any(String),
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

      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.deleteItem("item-1");
      });

      await waitFor(() => {
        const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());

        expect(data).toHaveLength(1);
        expect(data![0]!.id).toBe("item-2");
      });

      expect(mockDeleteItemMutate).toHaveBeenCalled();
      expect(mockDeleteItemMutate.mock.calls[0]![0]).toEqual({ itemId: "item-1", version: 1 });
    });

    it("reverts optimistic update on error", async () => {
      const item1 = createMockItem({ id: "item-1" });

      queryClient.setQueryData(getQueryKey(), [item1]);

      mockDeleteItemMutate.mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.deleteItem("item-1");
      });

      await waitFor(() => {
        const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());

        expect(data).toHaveLength(1);
        expect(data![0]!.id).toBe("item-1");
      });
    });
  });

  describe("moveItem", () => {
    it("applies optimistic update for same-slot reorder", async () => {
      const item1 = createMockItem({ id: "item-1", sortOrder: 0 });
      const item2 = createMockItem({ id: "item-2", sortOrder: 1 });

      queryClient.setQueryData(getQueryKey(), [item1, item2]);

      mockMoveItemMutate.mockResolvedValue({ success: true, moved: true });

      const { result } = renderHook(() => useCalendarMutations(), {
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
      expect(mockMoveItemMutate.mock.calls[0]![0]).toEqual({
        itemId: "item-2",
        version: 1,
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

      const { result } = renderHook(() => useCalendarMutations(), {
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

      const { result } = renderHook(() => useCalendarMutations(), {
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

      const { result } = renderHook(() => useCalendarMutations(), {
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

    it("keeps the optimistic move when the mutation is Queued (backend unreachable)", async () => {
      const item = createMockItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      queryClient.setQueryData(getQueryKey(), [item]);

      // A backend-unreachable failure means the mutation was captured into the
      // Outbox (Queued) — the optimistic move must be preserved, not rolled back.
      mockMoveItemMutate.mockRejectedValue(new TypeError("Failed to fetch"));

      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.moveItem("item-1", "2025-01-20", "Dinner", 0);
      });

      await waitFor(() => {
        expect(queryClient.isMutating()).toBe(0);
      });

      const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());
      const moved = data!.find((i) => i.id === "item-1");

      expect(moved?.date).toBe("2025-01-20");
      expect(moved?.slot).toBe("Dinner");
    });
  });

  describe("updateItem", () => {
    it("includes the current version in mutation input", async () => {
      const item = createMockItem({ id: "item-1", title: "Old title", version: 4 });

      queryClient.setQueryData(getQueryKey(), [item]);

      mockUpdateItemMutate.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.updateItem("item-1", "New title");
      });

      await waitFor(() => {
        expect(mockUpdateItemMutate.mock.calls[0]?.[0]).toEqual({
          itemId: "item-1",
          version: 4,
          title: "New title",
        });
      });
    });
  });

  describe("a write's own answer", () => {
    const range = { startISO, endISO };
    const withoutTimes = (items: PlannedItemFromQuery[] | undefined) =>
      items?.map(({ createdAt: _c, updatedAt: _u, ...rest }) => rest);

    function setup() {
      const a = createMockItem({ id: "a", slot: "Breakfast", sortOrder: 0, title: "a" });
      const b = createMockItem({ id: "b", slot: "Breakfast", sortOrder: 1, title: "b" });

      queryClient.setQueryData(getQueryKey(), [a, b]);
      const answer = { ...a, slot: "Lunch" as const, sortOrder: 0, version: 2 };
      const echo = {
        item: answer,
        targetSlotItems: [{ id: "a", sortOrder: 0 }],
        sourceSlotItems: [{ id: "b", sortOrder: 0 }],
        oldDate: a.date,
        oldSlot: a.slot,
        oldSortOrder: 0,
      };

      return { a, answer, echo };
    }

    it("places the moved plan's new version, so its next write is not stale", async () => {
      const { answer } = setup();

      mockMoveItemMutate.mockResolvedValue({ success: true, moved: true, item: answer });
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => result.current.moveItem("a", "2025-01-15", "Lunch", 0));
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));
      act(() => result.current.moveItem("a", "2025-01-15", "Dinner", 0));

      await waitFor(() => expect(mockMoveItemMutate.mock.calls[1]?.[0].version).toBe(2));
    });

    it("places the updated plan's new version, so its next write is not stale", async () => {
      const { a } = setup();

      mockUpdateItemMutate.mockResolvedValue({
        success: true,
        stale: false,
        item: { ...a, title: "renamed", version: 2 },
      });
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => result.current.updateItem("a", "renamed"));
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));
      act(() => result.current.updateItem("a", "again"));

      await waitFor(() => expect(mockUpdateItemMutate.mock.calls[1]?.[0].version).toBe(2));
    });

    it("an answer then its echo leaves the cache as either alone would", async () => {
      const { answer, echo } = setup();
      let answerMove!: (result: object) => void;

      mockMoveItemMutate.mockReturnValue(new Promise((resolve) => (answerMove = resolve)));
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => result.current.moveItem("a", "2025-01-15", "Lunch", 0));
      await waitFor(() => expect(mockMoveItemMutate).toHaveBeenCalled());
      const optimistic = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey())!;
      const echoOnly = applyMoveEchoInRange(optimistic, echo, range);

      await act(async () => answerMove({ success: true, moved: true, item: answer }));
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));
      const answerOnly = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey())!;
      const answerThenEcho = applyMoveEchoInRange(answerOnly, echo, range);

      expect(optimistic.find((item) => item.id === "a")?.version).toBe(2);
      expect(answerOnly.find((item) => item.id === "a")?.version).toBe(2);
      expect(withoutTimes(echoOnly)).toEqual(withoutTimes(answerOnly));
      expect(withoutTimes(answerThenEcho)).toEqual(withoutTimes(answerOnly));
    });
  });

  describe("overlapping writes to one plan", () => {
    const range = { startISO, endISO };

    function answerLater() {
      let answer!: (result: object) => void;
      const promise = new Promise<object>((resolve) => (answer = resolve));

      return { promise, answer };
    }

    function setup() {
      const a = createMockItem({ id: "a", title: "a", version: 3 });
      const b = createMockItem({ id: "b", title: "b", sortOrder: 1 });

      queryClient.setQueryData(getQueryKey(), [a, b]);

      return { a };
    }

    const cachedA = () =>
      queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey())!.find((i) => i.id === "a");

    it("a rename then a move in one tick send v then v+1, the move once the rename answered", async () => {
      const { a } = setup();
      const rename = answerLater();

      mockUpdateItemMutate.mockReturnValue(rename.promise);
      mockMoveItemMutate.mockResolvedValue({
        success: true,
        moved: true,
        item: { ...a, title: "renamed", date: "2025-01-20", version: 5 },
      });
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.updateItem("a", "renamed");
        result.current.moveItem("a", "2025-01-20", "Breakfast", 0);
      });
      await waitFor(() => expect(mockUpdateItemMutate).toHaveBeenCalledTimes(1));
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(mockMoveItemMutate).not.toHaveBeenCalled();
      expect(cachedA()).toMatchObject({ title: "renamed", date: "2025-01-20", version: 5 });

      await act(async () =>
        rename.answer({ success: true, stale: false, item: { ...a, title: "renamed", version: 4 } })
      );
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));

      expect(mockUpdateItemMutate.mock.calls[0]![0].version).toBe(3);
      expect(mockMoveItemMutate.mock.calls[0]![0].version).toBe(4);
      expect(cachedA()).toMatchObject({ title: "renamed", date: "2025-01-20", version: 5 });
    });

    it("two moves in one tick send v then v+1, the second once the first answered", async () => {
      const { a } = setup();
      const first = answerLater();

      mockMoveItemMutate.mockReturnValueOnce(first.promise).mockResolvedValueOnce({
        success: true,
        moved: true,
        item: { ...a, date: "2025-01-21", version: 5 },
      });
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.moveItem("a", "2025-01-20", "Breakfast", 0);
        result.current.moveItem("a", "2025-01-21", "Breakfast", 0);
      });
      await waitFor(() => expect(mockMoveItemMutate).toHaveBeenCalledTimes(1));
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(mockMoveItemMutate).toHaveBeenCalledTimes(1);

      await act(async () =>
        first.answer({ success: true, moved: true, item: { ...a, date: "2025-01-20", version: 4 } })
      );
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));

      expect(mockMoveItemMutate.mock.calls.map(([input]) => input.version)).toEqual([3, 4]);
      expect(cachedA()).toMatchObject({ date: "2025-01-21", version: 5 });
    });

    it("the first move's echo leaves the second move's optimistic cache alone", () => {
      const { a } = setup();

      mockMoveItemMutate.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.moveItem("a", "2025-01-20", "Breakfast", 0);
        result.current.moveItem("a", "2025-01-21", "Breakfast", 0);
      });
      const optimistic = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey())!;
      const echo = {
        item: { ...a, date: "2025-01-20", version: 4 },
        targetSlotItems: [{ id: "a", sortOrder: 0 }],
        sourceSlotItems: [{ id: "b", sortOrder: 7 }],
        oldDate: a.date,
        oldSlot: a.slot,
        oldSortOrder: 0,
      };

      expect(applyMoveEchoInRange(optimistic, echo, range)).toBe(optimistic);
    });

    it.each([
      {
        name: "a move's no-op",
        write: (mutations: ReturnType<typeof useCalendarMutations>) => {
          mockMoveItemMutate.mockResolvedValue({ success: true, moved: false });
          mutations.moveItem("a", "2025-01-20", "Breakfast", 0);
        },
      },
      {
        name: "a failed update",
        write: (mutations: ReturnType<typeof useCalendarMutations>) => {
          mockUpdateItemMutate.mockResolvedValue({ success: false });
          mutations.updateItem("a", "renamed");
        },
      },
    ])("$name answer, carrying no item, rereads", async ({ write }) => {
      setup();
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => write(result.current));

      await waitFor(() =>
        expect(queryClient.getQueryState(getQueryKey())?.isInvalidated).toBe(true)
      );
    });
  });
});
