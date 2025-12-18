import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

import {
  createTestQueryClient,
  createTestWrapper,
  createMockGrocery,
  createMockRecurringGrocery,
  createMockGroceriesData,
} from "./test-utils";

// Mock the tRPC provider
const mockQueryKey = ["groceries", "list"];
const mockQueryOptions = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    groceries: {
      list: {
        queryKey: () => mockQueryKey,
        queryOptions: () => mockQueryOptions(),
      },
    },
  }),
}));

// Import after mocking
import { useGroceriesQuery } from "@/hooks/groceries/use-groceries-query";

describe("useGroceriesQuery", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("initial state", () => {
    it("returns empty arrays when no data is loaded", () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockGroceriesData(),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.groceries).toEqual([]);
      expect(result.current.recurringGroceries).toEqual([]);
      expect(result.current.queryKey).toEqual(mockQueryKey);
    });

    it("returns loading state initially", () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: () => new Promise(() => {}), // Never resolves
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("data fetching", () => {
    it("returns groceries after successful fetch", async () => {
      const mockGroceries = [
        createMockGrocery({ id: "g1", name: "Milk" }),
        createMockGrocery({ id: "g2", name: "Bread" }),
      ];
      const mockRecurring = [createMockRecurringGrocery({ id: "r1", name: "Weekly Eggs" })];

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockGroceriesData(mockGroceries, mockRecurring),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.groceries).toEqual(mockGroceries);
      expect(result.current.recurringGroceries).toEqual(mockRecurring);
    });

    it("handles fetch failure gracefully", async () => {
      const testError = new Error("Network error");

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => {
          throw testError;
        },
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Wait for the query to complete (error or success)
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 2000 }
      );

      // When query fails, TanStack Query stores the error
      // The hook should still return empty arrays as fallback
      expect(result.current.groceries).toEqual([]);
      expect(result.current.recurringGroceries).toEqual([]);
    });
  });

  describe("setGroceriesData", () => {
    it("updates query cache with new data", async () => {
      const initialGroceries = [createMockGrocery({ id: "g1", name: "Milk" })];
      const initialData = createMockGroceriesData(initialGroceries, []);

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => initialData,
      });

      // Pre-seed the cache with initial data
      queryClient.setQueryData(mockQueryKey, initialData);

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Wait for initial data
      await waitFor(() => {
        expect(result.current.groceries).toHaveLength(1);
      });

      const newGrocery = createMockGrocery({ id: "g2", name: "Bread" });

      act(() => {
        result.current.setGroceriesData(
          (prev: ReturnType<typeof createMockGroceriesData> | undefined) => ({
            ...prev!,
            groceries: [...prev!.groceries, newGrocery],
          })
        );
      });

      // Query cache should be updated
      const cachedData = queryClient.getQueryData(mockQueryKey) as ReturnType<
        typeof createMockGroceriesData
      >;

      expect(cachedData?.groceries).toHaveLength(2);
      expect(cachedData?.groceries[1]).toEqual(newGrocery);
    });

    it("handles undefined previous data safely", async () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => undefined,
      });

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Should not throw when previous data is undefined
      act(() => {
        result.current.setGroceriesData(
          (prev: ReturnType<typeof createMockGroceriesData> | undefined) => {
            if (!prev) return prev;

            return { ...prev, groceries: [] };
          }
        );
      });

      expect(result.current.groceries).toEqual([]);
    });
  });

  describe("invalidate", () => {
    it("triggers refetch when invalidate is called", async () => {
      let fetchCount = 0;
      const mockGroceries = [createMockGrocery({ id: "g1", name: "Milk" })];

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => {
          fetchCount++;

          return createMockGroceriesData(mockGroceries, []);
        },
      });

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialFetchCount = fetchCount;

      act(() => {
        result.current.invalidate();
      });

      await waitFor(() => {
        expect(fetchCount).toBeGreaterThan(initialFetchCount);
      });
    });
  });

  describe("queryKey", () => {
    it("returns the correct query key for cache operations", () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockGroceriesData(),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.queryKey).toEqual(["groceries", "list"]);
    });
  });
});
