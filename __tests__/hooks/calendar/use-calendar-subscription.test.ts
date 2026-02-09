import { describe, it, expect, vi, beforeEach } from "vitest";

import { createTestQueryClient, createTestWrapper } from "./test-utils";

type SubscriptionCallback = (data: unknown) => void;
let subscriptionCallbacks: Record<string, SubscriptionCallback> = {};

vi.mock("@trpc/tanstack-react-query", () => ({
  useSubscription: vi.fn(),
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    calendar: {
      listItems: {
        queryKey: (input: { startISO: string; endISO: string }) => ["calendar", "listItems", input],
      },
      onItemCreated: {
        subscriptionOptions: (_input: unknown, options: { onData: SubscriptionCallback }) => {
          subscriptionCallbacks["onItemCreated"] = options?.onData;

          return { enabled: true };
        },
      },
      onItemDeleted: {
        subscriptionOptions: (_input: unknown, options: { onData: SubscriptionCallback }) => {
          subscriptionCallbacks["onItemDeleted"] = options?.onData;

          return { enabled: true };
        },
      },
      onItemMoved: {
        subscriptionOptions: (_input: unknown, options: { onData: SubscriptionCallback }) => {
          subscriptionCallbacks["onItemMoved"] = options?.onData;

          return { enabled: true };
        },
      },
      onItemUpdated: {
        subscriptionOptions: (_input: unknown, options: { onData: SubscriptionCallback }) => {
          subscriptionCallbacks["onItemUpdated"] = options?.onData;

          return { enabled: true };
        },
      },
      onFailed: {
        subscriptionOptions: (_input: unknown, options: { onData: SubscriptionCallback }) => {
          subscriptionCallbacks["onFailed"] = options?.onData;

          return { enabled: true };
        },
      },
    },
  }),
}));

// eslint-disable-next-line import/order
import { renderHook } from "@testing-library/react";

import { useCalendarSubscription } from "@/hooks/calendar/use-calendar-subscription";

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

function createMockPlannedItem(
  overrides: Partial<PlannedItemFromQuery> = {}
): PlannedItemFromQuery {
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

describe("useCalendarSubscription", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  const startISO = "2025-01-01";
  const endISO = "2025-01-31";

  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionCallbacks = {};
    queryClient = createTestQueryClient();
  });

  function renderSubscriptionHook() {
    return renderHook(() => useCalendarSubscription(startISO, endISO), {
      wrapper: createTestWrapper(queryClient),
    });
  }

  function getQueryKey() {
    return ["calendar", "listItems", { startISO, endISO }];
  }

  describe("onItemCreated subscription", () => {
    it("adds new item to cache with recipe fields", () => {
      queryClient.setQueryData(getQueryKey(), []);
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onItemCreated"];

      expect(callback).toBeDefined();

      callback({
        item: {
          id: "new-item-1",
          userId: "user-1",
          date: "2025-01-15",
          slot: "Breakfast",
          sortOrder: 0,
          itemType: "recipe",
          recipeId: "recipe-456",
          title: null,
          recipeName: "New Recipe",
          recipeImage: "/img/recipe.jpg",
          servings: 2,
          calories: 300,
        },
      });

      const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());

      expect(data).toHaveLength(1);
      expect(data![0]).toMatchObject({
        id: "new-item-1",
        recipeName: "New Recipe",
        recipeImage: "/img/recipe.jpg",
        servings: 2,
        calories: 300,
      });
    });

    it("does not add duplicate items", () => {
      const existingItem = createMockPlannedItem({ id: "existing-1" });

      queryClient.setQueryData(getQueryKey(), [existingItem]);
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onItemCreated"];

      callback({
        item: {
          id: "existing-1",
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
        },
      });

      const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());

      expect(data).toHaveLength(1);
    });

    it("maintains sort order after adding item", () => {
      const item1 = createMockPlannedItem({
        id: "item-1",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });
      const item2 = createMockPlannedItem({
        id: "item-2",
        date: "2025-01-15",
        slot: "Lunch",
        sortOrder: 0,
      });

      queryClient.setQueryData(getQueryKey(), [item2, item1]);
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onItemCreated"];

      callback({
        item: {
          id: "item-3",
          userId: "user-1",
          date: "2025-01-14",
          slot: "Dinner",
          sortOrder: 0,
          itemType: "note",
          recipeId: null,
          title: "Earlier Note",
          recipeName: null,
          recipeImage: null,
          servings: null,
          calories: null,
        },
      });

      const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());

      expect(data).toHaveLength(3);
      expect(data![0].date).toBe("2025-01-14");
      expect(data![1].date).toBe("2025-01-15");
      expect(data![1].slot).toBe("Breakfast");
      expect(data![2].slot).toBe("Lunch");
    });
  });

  describe("onItemDeleted subscription", () => {
    it("removes item from cache", () => {
      const item1 = createMockPlannedItem({ id: "item-1" });
      const item2 = createMockPlannedItem({ id: "item-2" });

      queryClient.setQueryData(getQueryKey(), [item1, item2]);
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onItemDeleted"];

      expect(callback).toBeDefined();

      callback({ itemId: "item-1", date: "2025-01-15", slot: "Breakfast" });

      const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());

      expect(data).toHaveLength(1);
      expect(data![0].id).toBe("item-2");
    });
  });

  describe("onItemMoved subscription", () => {
    it("updates moved item position and date/slot", () => {
      const item = createMockPlannedItem({
        id: "moved-item",
        date: "2025-01-15",
        slot: "Breakfast",
        sortOrder: 0,
      });

      queryClient.setQueryData(getQueryKey(), [item]);
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onItemMoved"];

      expect(callback).toBeDefined();

      callback({
        item: {
          id: "moved-item",
          userId: "user-1",
          date: "2025-01-16",
          slot: "Dinner",
          sortOrder: 2,
          itemType: "recipe",
          recipeId: "recipe-123",
          title: null,
          recipeName: "Test Recipe",
          recipeImage: null,
          servings: 4,
          calories: 500,
        },
        targetSlotItems: [{ id: "moved-item", sortOrder: 2 }],
        sourceSlotItems: null,
        oldDate: "2025-01-15",
        oldSlot: "Breakfast",
        oldSortOrder: 0,
      });

      const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());

      expect(data).toHaveLength(1);
      expect(data![0]).toMatchObject({
        id: "moved-item",
        date: "2025-01-16",
        slot: "Dinner",
        sortOrder: 2,
      });
    });

    it("updates sortOrder for all items in target slot", () => {
      const item1 = createMockPlannedItem({ id: "item-1", sortOrder: 0 });
      const item2 = createMockPlannedItem({ id: "item-2", sortOrder: 1 });
      const item3 = createMockPlannedItem({ id: "item-3", sortOrder: 2 });

      queryClient.setQueryData(getQueryKey(), [item1, item2, item3]);
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onItemMoved"];

      callback({
        item: {
          id: "item-3",
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
        },
        targetSlotItems: [
          { id: "item-3", sortOrder: 0 },
          { id: "item-1", sortOrder: 1 },
          { id: "item-2", sortOrder: 2 },
        ],
        sourceSlotItems: null,
        oldDate: "2025-01-15",
        oldSlot: "Breakfast",
        oldSortOrder: 2,
      });

      const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());

      expect(data).toHaveLength(3);

      const sorted = [...data!].sort((a, b) => a.sortOrder - b.sortOrder);

      expect(sorted[0].id).toBe("item-3");
      expect(sorted[0].sortOrder).toBe(0);
      expect(sorted[1].id).toBe("item-1");
      expect(sorted[1].sortOrder).toBe(1);
      expect(sorted[2].id).toBe("item-2");
      expect(sorted[2].sortOrder).toBe(2);
    });

    it("updates sortOrder for items in both source and target slots on cross-slot move", () => {
      const breakfast1 = createMockPlannedItem({ id: "b-1", slot: "Breakfast", sortOrder: 0 });
      const breakfast2 = createMockPlannedItem({ id: "b-2", slot: "Breakfast", sortOrder: 1 });
      const lunch1 = createMockPlannedItem({ id: "l-1", slot: "Lunch", sortOrder: 0 });

      queryClient.setQueryData(getQueryKey(), [breakfast1, breakfast2, lunch1]);
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onItemMoved"];

      callback({
        item: {
          id: "b-1",
          userId: "user-1",
          date: "2025-01-15",
          slot: "Lunch",
          sortOrder: 1,
          itemType: "recipe",
          recipeId: "recipe-123",
          title: null,
          recipeName: "Test Recipe",
          recipeImage: null,
          servings: 4,
          calories: 500,
        },
        targetSlotItems: [
          { id: "l-1", sortOrder: 0 },
          { id: "b-1", sortOrder: 1 },
        ],
        sourceSlotItems: [{ id: "b-2", sortOrder: 0 }],
        oldDate: "2025-01-15",
        oldSlot: "Breakfast",
        oldSortOrder: 0,
      });

      const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());

      expect(data).toHaveLength(3);

      const movedItem = data!.find((i) => i.id === "b-1");

      expect(movedItem).toMatchObject({
        slot: "Lunch",
        sortOrder: 1,
      });

      const remainingBreakfast = data!.find((i) => i.id === "b-2");

      expect(remainingBreakfast?.sortOrder).toBe(0);

      const lunchItem = data!.find((i) => i.id === "l-1");

      expect(lunchItem?.sortOrder).toBe(0);
    });

    it("handles same-slot reorder without sourceSlotItems", () => {
      const item1 = createMockPlannedItem({ id: "item-1", sortOrder: 0 });
      const item2 = createMockPlannedItem({ id: "item-2", sortOrder: 1 });

      queryClient.setQueryData(getQueryKey(), [item1, item2]);
      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onItemMoved"];

      callback({
        item: {
          id: "item-2",
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
        },
        targetSlotItems: [
          { id: "item-2", sortOrder: 0 },
          { id: "item-1", sortOrder: 1 },
        ],
        sourceSlotItems: null,
        oldDate: "2025-01-15",
        oldSlot: "Breakfast",
        oldSortOrder: 1,
      });

      const data = queryClient.getQueryData<PlannedItemFromQuery[]>(getQueryKey());
      const sorted = [...data!].sort((a, b) => a.sortOrder - b.sortOrder);

      expect(sorted[0].id).toBe("item-2");
      expect(sorted[1].id).toBe("item-1");
    });
  });

  describe("onFailed subscription", () => {
    it("invalidates query on failure", () => {
      queryClient.setQueryData(getQueryKey(), []);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderSubscriptionHook();

      const callback = subscriptionCallbacks["onFailed"];

      expect(callback).toBeDefined();

      callback({ reason: "Something went wrong" });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: getQueryKey(),
      });
    });
  });
});
