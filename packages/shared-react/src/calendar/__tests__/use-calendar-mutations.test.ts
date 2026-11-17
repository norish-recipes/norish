import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { applyMoveEchoInRange, upsertItemInRange } from "../calendar-cache-merge";
import { useCalendarMutations } from "../use-calendar-mutations";

const mockCreateItemMutate = vi.fn();
const mockDeleteItemMutate = vi.fn();
const mockMoveItemMutate = vi.fn();
const mockUpdateItemMutate = vi.fn();
const mockEditItemMutate = vi.fn();

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    recipes: {
      list: { pathKey: () => [["recipes", "list"]] },
      get: { queryKey: (input: { id: string }) => [["recipes", "get"], { input, type: "query" }] },
    },
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
      editItem: {
        mutationOptions: (options: Record<string, unknown>) => ({
          mutationFn: mockEditItemMutate,
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

  describe("a plan made before its answer", () => {
    const READER = { id: "user-1" } as never;
    const planned = () => queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey())!;
    const render = () =>
      renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient, fakePlatformAdapter("phone", READER)),
      });

    beforeEach(() => {
      queryClient.setQueryData(getQueryKey(), [
        createMockItem({ id: "lunch-1", slot: "Lunch", sortOrder: 0 }),
      ]);
      queryClient.setQueryData([["recipes", "list"], { input: {}, type: "infinite" }], {
        pages: [
          {
            recipes: [
              { id: "r-soup", name: "Soup", image: "/soup.jpg", servings: 2, calories: 300 },
            ],
            total: 1,
            nextCursor: null,
          },
        ],
        pageParams: [0],
      });
    });

    it("shows at once, last in its slot, with its recipe's name and photo", () => {
      mockCreateItemMutate.mockReturnValue(new Promise(() => {}));
      const { result } = render();

      act(() => result.current.planRecipe("2025-01-15", "Lunch", "r-soup"));

      expect(planned().at(-1)).toMatchObject({
        userId: "user-1",
        slot: "Lunch",
        sortOrder: 1,
        recipeName: "Soup",
        recipeImage: "/soup.jpg",
        servings: 2,
        version: 1,
      });
    });

    it("shows a note with its text", () => {
      mockCreateItemMutate.mockReturnValue(new Promise(() => {}));
      const { result } = render();

      act(() => result.current.planNote("2025-01-15", "Dinner", "Leftovers"));

      expect(planned().find((item) => item.slot === "Dinner")).toMatchObject({
        itemType: "note",
        title: "Leftovers",
      });
    });

    it("is one plan once the answer and the created echo land", async () => {
      mockCreateItemMutate.mockImplementation(async (input: { id: string }) => ({
        id: input.id,
        item: { ...createMockItem({ id: input.id, slot: "Lunch", sortOrder: 1 }), title: null },
      }));
      const { result } = render();

      act(() => result.current.planRecipe("2025-01-15", "Lunch", "r-soup"));
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));
      const { id } = mockCreateItemMutate.mock.calls[0]![0] as { id: string };

      // The created echo, as the subscription merges it.
      queryClient.setQueryData(
        getQueryKey(),
        upsertItemInRange(planned(), createMockItem({ id, slot: "Lunch", sortOrder: 1 }), {
          startISO,
          endISO,
        })
      );
      expect(planned().filter((item) => item.id === id)).toHaveLength(1);
      expect(planned().map((item) => item.id)).toEqual(["lunch-1", id]);
    });

    it("counts only its owner's plans in the slot, as the server does", () => {
      queryClient.setQueryData(getQueryKey(), [
        createMockItem({ id: "h-1", userId: "housemate", slot: "Dinner", sortOrder: 0 }),
        createMockItem({ id: "h-2", userId: "housemate", slot: "Dinner", sortOrder: 1 }),
        createMockItem({ id: "h-3", userId: "housemate", slot: "Dinner", sortOrder: 2 }),
      ]);
      mockCreateItemMutate.mockReturnValue(new Promise(() => {}));
      const { result } = render();

      act(() => result.current.planNote("2025-01-15", "Dinner", "Leftovers"));

      expect(planned().find((item) => item.userId === "user-1")).toMatchObject({ sortOrder: 0 });
    });

    it("moves with no index last among its owner's plans", () => {
      queryClient.setQueryData(getQueryKey(), [
        createMockItem({ id: "mine", slot: "Lunch", sortOrder: 0 }),
        createMockItem({ id: "h-1", userId: "housemate", slot: "Dinner", sortOrder: 0 }),
        createMockItem({ id: "h-2", userId: "housemate", slot: "Dinner", sortOrder: 1 }),
      ]);
      mockMoveItemMutate.mockReturnValue(new Promise(() => {}));
      const { result } = render();

      act(() => result.current.moveItem("mine", "2025-01-15", "Dinner"));

      expect(planned().find((item) => item.id === "mine")).toMatchObject({
        slot: "Dinner",
        sortOrder: 0,
      });
    });

    it("goes again when the create fails", async () => {
      mockCreateItemMutate.mockRejectedValue(new Error("refused"));
      const { result } = render();

      act(() => result.current.planNote("2025-01-15", "Lunch", "Leftovers"));
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));

      expect(planned().map((item) => item.id)).toEqual(["lunch-1"]);
    });
  });

  describe("a write the server refuses", () => {
    type Writes = ReturnType<typeof useCalendarMutations>;

    it.each([
      ["a plan", mockCreateItemMutate, (w: Writes) => w.planNote("2025-01-15", "Lunch", "Soup")],
      ["a remove", mockDeleteItemMutate, (w: Writes) => w.deleteItem("item-1")],
      ["a move", mockMoveItemMutate, (w: Writes) => w.moveItem("item-1", "2025-01-16", "Lunch")],
      ["an edit", mockUpdateItemMutate, (w: Writes) => w.updateItem("item-1", "Soup")],
      ["a save", mockEditItemMutate, (w: Writes) => w.saveItem("item-1", { slot: "Lunch" })],
    ])("tells the reader when %s is rolled back", async (_, mutation, write) => {
      queryClient.setQueryData(getQueryKey(), [createMockItem({ id: "item-1" })]);
      mutation.mockRejectedValue(new Error("refused"));
      const adapter = fakePlatformAdapter("phone", { id: "user-1" } as never);
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      act(() => write(result.current));
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));

      expect(adapter.showError).toHaveBeenCalledTimes(1);
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

    it("a move with no index sends none and shows the plan last in its slot", async () => {
      const moved = createMockItem({ id: "b-1", slot: "Breakfast", sortOrder: 0 });
      const lunch = [0, 1].map((n) =>
        createMockItem({ id: `l-${n}`, slot: "Lunch", sortOrder: n })
      );

      queryClient.setQueryData(getQueryKey(), [moved, ...lunch]);
      mockMoveItemMutate.mockResolvedValue({ success: true, moved: true, stale: false });

      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => result.current.moveItem("b-1", "2025-01-15", "Lunch"));

      expect(
        queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey())!.map((i) => i.id)
      ).toEqual(["l-0", "l-1", "b-1"]);
      await waitFor(() => expect(mockMoveItemMutate).toHaveBeenCalled());
      expect(mockMoveItemMutate.mock.calls[0]![0]).toMatchObject({ targetIndex: undefined });
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
      const move = Promise.withResolvers<object>();

      mockMoveItemMutate.mockReturnValue(move.promise);
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => result.current.moveItem("a", "2025-01-15", "Lunch", 0));
      await waitFor(() => expect(mockMoveItemMutate).toHaveBeenCalled());
      const optimistic = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey())!;
      const echoOnly = applyMoveEchoInRange(optimistic, echo, range);

      await act(async () => move.resolve({ success: true, moved: true, item: answer }));
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));
      const answerOnly = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey())!;
      const answerThenEcho = applyMoveEchoInRange(answerOnly, echo, range);

      expect(optimistic.find((item) => item.id === "a")?.version).toBe(2);
      expect(answerOnly.find((item) => item.id === "a")?.version).toBe(2);
      expect(withoutTimes(echoOnly)).toEqual(withoutTimes(answerOnly));
      expect(withoutTimes(answerThenEcho)).toEqual(withoutTimes(answerOnly));
    });
  });

  describe("saveItem", () => {
    const cached = () => queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey())!;
    const render = () =>
      renderHook(() => useCalendarMutations(), { wrapper: createTestWrapper(queryClient) });

    beforeEach(() => {
      mockMoveItemMutate.mockReset();
      mockUpdateItemMutate.mockReset();
      mockEditItemMutate.mockReset().mockReturnValue(new Promise(() => {}));
    });

    it("sends text, day and slot as exactly one write at the cached version", async () => {
      const note = createMockItem({ id: "n", itemType: "note", title: "Soup", version: 3 });
      const mate = createMockItem({ id: "m", date: "2025-01-20", slot: "Dinner" });

      queryClient.setQueryData(getQueryKey(), [note, mate]);
      const { result } = render();

      act(() =>
        result.current.saveItem("n", { title: "Leek soup", date: "2025-01-20", slot: "Dinner" })
      );
      await waitFor(() => expect(mockEditItemMutate).toHaveBeenCalledTimes(1));

      expect(mockEditItemMutate.mock.calls[0]![0]).toEqual({
        itemId: "n",
        version: 3,
        title: "Leek soup",
        date: "2025-01-20",
        slot: "Dinner",
      });
      expect(mockUpdateItemMutate).not.toHaveBeenCalled();
      expect(mockMoveItemMutate).not.toHaveBeenCalled();
      // Shown at once, last in its new slot, one version on.
      expect(cached().find((item) => item.id === "n")).toMatchObject({
        title: "Leek soup",
        date: "2025-01-20",
        slot: "Dinner",
        sortOrder: 1,
        version: 4,
      });
    });

    it("a text-only save changes the text in place, one version on", async () => {
      queryClient.setQueryData(getQueryKey(), [
        createMockItem({ id: "n", itemType: "note", title: "Soup", version: 3 }),
      ]);
      const { result } = render();

      act(() => result.current.saveItem("n", { title: "Leek soup" }));
      await waitFor(() => expect(mockEditItemMutate).toHaveBeenCalledTimes(1));

      expect(mockEditItemMutate.mock.calls[0]![0]).toEqual({
        itemId: "n",
        version: 3,
        title: "Leek soup",
      });
      expect(cached()[0]).toMatchObject({ title: "Leek soup", date: "2025-01-15", version: 4 });
    });

    it("a remove made while the save waits is sent once it answered, at the version it left", async () => {
      const note = createMockItem({ id: "n", itemType: "note", title: "Soup", version: 3 });
      const save = Promise.withResolvers<object>();

      queryClient.setQueryData(getQueryKey(), [note]);
      mockEditItemMutate.mockReturnValue(save.promise);
      mockDeleteItemMutate.mockResolvedValue({ success: true, stale: false });
      const { result } = render();

      act(() => result.current.saveItem("n", { title: "Leek soup", slot: "Lunch" }));
      act(() => result.current.deleteItem("n"));
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(mockDeleteItemMutate).not.toHaveBeenCalled();

      await act(async () =>
        save.resolve({
          success: true,
          stale: false,
          item: { ...note, title: "Leek soup", slot: "Lunch", version: 4 },
        })
      );
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));

      expect(mockDeleteItemMutate.mock.calls[0]![0]).toEqual({ itemId: "n", version: 4 });
      expect(cached()).toEqual([]);
    });
  });

  describe("overlapping writes to one plan", () => {
    const range = { startISO, endISO };

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
      const rename = Promise.withResolvers<object>();

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
        rename.resolve({
          success: true,
          stale: false,
          item: { ...a, title: "renamed", version: 4 },
        })
      );
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));

      expect(mockUpdateItemMutate.mock.calls[0]![0].version).toBe(3);
      expect(mockMoveItemMutate.mock.calls[0]![0].version).toBe(4);
      expect(cachedA()).toMatchObject({ title: "renamed", date: "2025-01-20", version: 5 });
    });

    it("two moves in one tick send v then v+1, the second once the first answered", async () => {
      const { a } = setup();
      const first = Promise.withResolvers<object>();

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
        first.resolve({
          success: true,
          moved: true,
          item: { ...a, date: "2025-01-20", version: 4 },
        })
      );
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));

      expect(mockMoveItemMutate.mock.calls.map(([input]) => input.version)).toEqual([3, 4]);
      expect(cachedA()).toMatchObject({ date: "2025-01-21", version: 5 });
    });

    it("a delete made while a move waits is sent once the move answered, with v+1", async () => {
      const { a } = setup();
      const move = Promise.withResolvers<object>();

      mockMoveItemMutate.mockReturnValue(move.promise);
      mockDeleteItemMutate.mockResolvedValue({ success: true, stale: false });
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => result.current.moveItem("a", "2025-01-20", "Breakfast", 0));
      await waitFor(() => expect(mockMoveItemMutate).toHaveBeenCalledTimes(1));
      act(() => result.current.deleteItem("a"));
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(mockDeleteItemMutate).not.toHaveBeenCalled();

      await act(async () =>
        move.resolve({ success: true, moved: true, item: { ...a, date: "2025-01-20", version: 4 } })
      );
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));

      expect(mockDeleteItemMutate.mock.calls[0]![0]).toEqual({ itemId: "a", version: 4 });
      // The delete's answer removes the plan the move's answer put back.
      expect(cachedA()).toBeUndefined();
    });

    it("a delete's answer removes a plan an echo put back meanwhile", async () => {
      const { a } = setup();
      const remove = Promise.withResolvers<object>();

      mockDeleteItemMutate.mockReturnValue(remove.promise);
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => result.current.deleteItem("a"));
      await waitFor(() => expect(mockDeleteItemMutate).toHaveBeenCalledTimes(1));
      // An earlier move's echo lands after the optimistic delete and appends the plan.
      act(() => {
        queryClient.setQueryData<PlannedItemFromQuery[]>(getQueryKey(), (items) => [...items!, a]);
      });
      await act(async () => remove.resolve({ success: true, stale: false }));
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));

      expect(cachedA()).toBeUndefined();
    });

    it("a first write that fails sends the second with v+1, answered stale, then rereads", async () => {
      setup();
      const rename = Promise.withResolvers<object>();

      mockUpdateItemMutate.mockReturnValue(rename.promise);
      mockMoveItemMutate.mockResolvedValue({ success: true, moved: false, stale: true });
      const { result } = renderHook(() => useCalendarMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.updateItem("a", "renamed");
        result.current.moveItem("a", "2025-01-20", "Breakfast", 0);
      });
      await waitFor(() => expect(mockUpdateItemMutate).toHaveBeenCalledTimes(1));
      // A real error, not backend-unreachable: the rename never happened.
      await act(async () => rename.reject(new Error("BAD_REQUEST")));
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));

      expect(mockMoveItemMutate.mock.calls[0]![0].version).toBe(4);
      expect(queryClient.getQueryState(getQueryKey())?.isInvalidated).toBe(true);
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
