import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  createTestQueryClient,
  createTestWrapper,
  createMockGrocery,
  createMockRecurringGrocery,
  createMockGroceriesData,
} from "./test-utils";

// Track subscription callbacks
const subscriptionCallbacks: Record<string, (data: unknown) => void> = {};

vi.mock("@trpc/tanstack-react-query", () => ({
  useSubscription: vi.fn((options) => {
    // Extract event name from the options and store callback
    if (options?.onData) {
      // Store the callback for testing
      const eventName = options.queryKey?.[0] ?? "unknown";

      subscriptionCallbacks[eventName] = options.onData;
    }

    return {
      data: undefined,
      error: null,
      isLoading: false,
    };
  }),
}));

vi.mock("@heroui/react", () => ({
  addToast: vi.fn(),
}));

// Mock the query key
const mockQueryKey = ["groceries", "list"];

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    groceries: {
      list: {
        queryKey: () => mockQueryKey,
        queryOptions: () => ({
          queryKey: mockQueryKey,
          queryFn: async () => createMockGroceriesData(),
        }),
      },
      onCreated: {
        subscriptionOptions: (input: unknown, options: { onData: (data: unknown) => void }) => {
          subscriptionCallbacks.onCreated = options.onData;

          return { queryKey: ["onCreated"] };
        },
      },
      onUpdated: {
        subscriptionOptions: (input: unknown, options: { onData: (data: unknown) => void }) => {
          subscriptionCallbacks.onUpdated = options.onData;

          return { queryKey: ["onUpdated"] };
        },
      },
      onDeleted: {
        subscriptionOptions: (input: unknown, options: { onData: (data: unknown) => void }) => {
          subscriptionCallbacks.onDeleted = options.onData;

          return { queryKey: ["onDeleted"] };
        },
      },
      onRecurringCreated: {
        subscriptionOptions: (input: unknown, options: { onData: (data: unknown) => void }) => {
          subscriptionCallbacks.onRecurringCreated = options.onData;

          return { queryKey: ["onRecurringCreated"] };
        },
      },
      onRecurringUpdated: {
        subscriptionOptions: (input: unknown, options: { onData: (data: unknown) => void }) => {
          subscriptionCallbacks.onRecurringUpdated = options.onData;

          return { queryKey: ["onRecurringUpdated"] };
        },
      },
      onRecurringDeleted: {
        subscriptionOptions: (input: unknown, options: { onData: (data: unknown) => void }) => {
          subscriptionCallbacks.onRecurringDeleted = options.onData;

          return { queryKey: ["onRecurringDeleted"] };
        },
      },
      onFailed: {
        subscriptionOptions: (input: unknown, options: { onData: (data: unknown) => void }) => {
          subscriptionCallbacks.onFailed = options.onData;

          return { queryKey: ["onFailed"] };
        },
      },
    },
  }),
}));

describe("useGroceriesSubscription", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear subscription callbacks
    Object.keys(subscriptionCallbacks).forEach((key) => {
      delete subscriptionCallbacks[key];
    });
    queryClient = createTestQueryClient();
  });

  describe("subscription setup", () => {
    it("sets up all subscription handlers", async () => {
      const initialData = createMockGroceriesData();

      queryClient.setQueryData(mockQueryKey, initialData);

      const { useGroceriesSubscription } =
        await import("@/hooks/groceries/use-groceries-subscription");

      renderHook(() => useGroceriesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Verify all subscription callbacks were registered
      expect(subscriptionCallbacks.onCreated).toBeDefined();
      expect(subscriptionCallbacks.onUpdated).toBeDefined();
      expect(subscriptionCallbacks.onDeleted).toBeDefined();
      expect(subscriptionCallbacks.onRecurringCreated).toBeDefined();
      expect(subscriptionCallbacks.onRecurringUpdated).toBeDefined();
      expect(subscriptionCallbacks.onRecurringDeleted).toBeDefined();
      expect(subscriptionCallbacks.onFailed).toBeDefined();
    });
  });

  describe("onCreated handler", () => {
    it("adds new groceries to the cache", async () => {
      const existingGrocery = createMockGrocery({ id: "g1", name: "Milk" });
      const initialData = createMockGroceriesData([existingGrocery], []);

      queryClient.setQueryData(mockQueryKey, initialData);

      const { useGroceriesSubscription } =
        await import("@/hooks/groceries/use-groceries-subscription");

      renderHook(() => useGroceriesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const newGrocery = createMockGrocery({ id: "g2", name: "Bread" });

      // Simulate WebSocket event
      act(() => {
        subscriptionCallbacks.onCreated({ groceries: [newGrocery] });
      });

      const cachedData =
        queryClient.getQueryData<ReturnType<typeof createMockGroceriesData>>(mockQueryKey);

      expect(cachedData?.groceries).toHaveLength(2);
      expect(cachedData?.groceries[0]).toEqual(newGrocery);
    });

    it("does not add duplicate groceries", async () => {
      const existingGrocery = createMockGrocery({ id: "g1", name: "Milk" });
      const initialData = createMockGroceriesData([existingGrocery], []);

      queryClient.setQueryData(mockQueryKey, initialData);

      const { useGroceriesSubscription } =
        await import("@/hooks/groceries/use-groceries-subscription");

      renderHook(() => useGroceriesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Try to add the same grocery
      act(() => {
        subscriptionCallbacks.onCreated({ groceries: [existingGrocery] });
      });

      const cachedData =
        queryClient.getQueryData<ReturnType<typeof createMockGroceriesData>>(mockQueryKey);

      expect(cachedData?.groceries).toHaveLength(1);
    });
  });

  describe("onUpdated handler", () => {
    it("updates existing groceries in the cache", async () => {
      const existingGrocery = createMockGrocery({ id: "g1", name: "Milk", isDone: false });
      const initialData = createMockGroceriesData([existingGrocery], []);

      queryClient.setQueryData(mockQueryKey, initialData);

      const { useGroceriesSubscription } =
        await import("@/hooks/groceries/use-groceries-subscription");

      renderHook(() => useGroceriesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const updatedGrocery = { ...existingGrocery, isDone: true };

      act(() => {
        subscriptionCallbacks.onUpdated({ changedGroceries: [updatedGrocery] });
      });

      const cachedData =
        queryClient.getQueryData<ReturnType<typeof createMockGroceriesData>>(mockQueryKey);

      expect(cachedData?.groceries[0].isDone).toBe(true);
    });

    it("leaves non-updated groceries unchanged", async () => {
      const grocery1 = createMockGrocery({ id: "g1", name: "Milk" });
      const grocery2 = createMockGrocery({ id: "g2", name: "Bread" });
      const initialData = createMockGroceriesData([grocery1, grocery2], []);

      queryClient.setQueryData(mockQueryKey, initialData);

      const { useGroceriesSubscription } =
        await import("@/hooks/groceries/use-groceries-subscription");

      renderHook(() => useGroceriesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const updatedGrocery1 = { ...grocery1, name: "Whole Milk" };

      act(() => {
        subscriptionCallbacks.onUpdated({ changedGroceries: [updatedGrocery1] });
      });

      const cachedData =
        queryClient.getQueryData<ReturnType<typeof createMockGroceriesData>>(mockQueryKey);

      expect(cachedData?.groceries.find((g) => g.id === "g1")?.name).toBe("Whole Milk");
      expect(cachedData?.groceries.find((g) => g.id === "g2")?.name).toBe("Bread");
    });
  });

  describe("onDeleted handler", () => {
    it("removes deleted groceries from the cache", async () => {
      const grocery1 = createMockGrocery({ id: "g1", name: "Milk" });
      const grocery2 = createMockGrocery({ id: "g2", name: "Bread" });
      const initialData = createMockGroceriesData([grocery1, grocery2], []);

      queryClient.setQueryData(mockQueryKey, initialData);

      const { useGroceriesSubscription } =
        await import("@/hooks/groceries/use-groceries-subscription");

      renderHook(() => useGroceriesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        subscriptionCallbacks.onDeleted({ groceryIds: ["g1"] });
      });

      const cachedData =
        queryClient.getQueryData<ReturnType<typeof createMockGroceriesData>>(mockQueryKey);

      expect(cachedData?.groceries).toHaveLength(1);
      expect(cachedData?.groceries[0].id).toBe("g2");
    });

    it("handles deleting multiple groceries", async () => {
      const grocery1 = createMockGrocery({ id: "g1", name: "Milk" });
      const grocery2 = createMockGrocery({ id: "g2", name: "Bread" });
      const grocery3 = createMockGrocery({ id: "g3", name: "Eggs" });
      const initialData = createMockGroceriesData([grocery1, grocery2, grocery3], []);

      queryClient.setQueryData(mockQueryKey, initialData);

      const { useGroceriesSubscription } =
        await import("@/hooks/groceries/use-groceries-subscription");

      renderHook(() => useGroceriesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        subscriptionCallbacks.onDeleted({ groceryIds: ["g1", "g3"] });
      });

      const cachedData =
        queryClient.getQueryData<ReturnType<typeof createMockGroceriesData>>(mockQueryKey);

      expect(cachedData?.groceries).toHaveLength(1);
      expect(cachedData?.groceries[0].id).toBe("g2");
    });
  });

  describe("onRecurringCreated handler", () => {
    it("adds new recurring grocery and linked grocery to cache", async () => {
      const initialData = createMockGroceriesData([], []);

      queryClient.setQueryData(mockQueryKey, initialData);

      const { useGroceriesSubscription } =
        await import("@/hooks/groceries/use-groceries-subscription");

      renderHook(() => useGroceriesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const newGrocery = createMockGrocery({ id: "g1", name: "Eggs", recurringGroceryId: "r1" });
      const newRecurring = createMockRecurringGrocery({ id: "r1", name: "Weekly Eggs" });

      act(() => {
        subscriptionCallbacks.onRecurringCreated({
          grocery: newGrocery,
          recurringGrocery: newRecurring,
        });
      });

      const cachedData =
        queryClient.getQueryData<ReturnType<typeof createMockGroceriesData>>(mockQueryKey);

      expect(cachedData?.groceries).toHaveLength(1);
      expect(cachedData?.recurringGroceries).toHaveLength(1);
      expect(cachedData?.groceries[0]).toEqual(newGrocery);
      expect(cachedData?.recurringGroceries[0]).toEqual(newRecurring);
    });
  });

  describe("onRecurringUpdated handler", () => {
    it("updates both recurring grocery and linked grocery in cache", async () => {
      const grocery = createMockGrocery({ id: "g1", name: "Eggs", recurringGroceryId: "r1" });
      const recurring = createMockRecurringGrocery({ id: "r1", name: "Weekly Eggs" });
      const initialData = createMockGroceriesData([grocery], [recurring]);

      queryClient.setQueryData(mockQueryKey, initialData);

      const { useGroceriesSubscription } =
        await import("@/hooks/groceries/use-groceries-subscription");

      renderHook(() => useGroceriesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      const updatedGrocery = { ...grocery, name: "Organic Eggs" };
      const updatedRecurring = { ...recurring, name: "Weekly Organic Eggs" };

      act(() => {
        subscriptionCallbacks.onRecurringUpdated({
          grocery: updatedGrocery,
          recurringGrocery: updatedRecurring,
        });
      });

      const cachedData =
        queryClient.getQueryData<ReturnType<typeof createMockGroceriesData>>(mockQueryKey);

      expect(cachedData?.groceries[0].name).toBe("Organic Eggs");
      expect(cachedData?.recurringGroceries[0].name).toBe("Weekly Organic Eggs");
    });
  });

  describe("onRecurringDeleted handler", () => {
    it("removes recurring grocery and all linked groceries from cache", async () => {
      const grocery1 = createMockGrocery({ id: "g1", name: "Eggs", recurringGroceryId: "r1" });
      const grocery2 = createMockGrocery({ id: "g2", name: "Milk", recurringGroceryId: null });
      const recurring = createMockRecurringGrocery({ id: "r1", name: "Weekly Eggs" });
      const initialData = createMockGroceriesData([grocery1, grocery2], [recurring]);

      queryClient.setQueryData(mockQueryKey, initialData);

      const { useGroceriesSubscription } =
        await import("@/hooks/groceries/use-groceries-subscription");

      renderHook(() => useGroceriesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        subscriptionCallbacks.onRecurringDeleted({ recurringGroceryId: "r1" });
      });

      const cachedData =
        queryClient.getQueryData<ReturnType<typeof createMockGroceriesData>>(mockQueryKey);

      expect(cachedData?.groceries).toHaveLength(1);
      expect(cachedData?.groceries[0].id).toBe("g2");
      expect(cachedData?.recurringGroceries).toHaveLength(0);
    });
  });

  describe("onFailed handler", () => {
    it("shows toast notification on failure", async () => {
      const { addToast } = await import("@heroui/react");
      const initialData = createMockGroceriesData();

      queryClient.setQueryData(mockQueryKey, initialData);

      const { useGroceriesSubscription } =
        await import("@/hooks/groceries/use-groceries-subscription");

      renderHook(() => useGroceriesSubscription(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        subscriptionCallbacks.onFailed({ reason: "Failed to save grocery" });
      });

      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "danger",
          title: "Failed to save grocery",
        })
      );
    });
  });
});
