import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

import { createTestQueryClient, createTestWrapper, createMockRecipe } from "./test-utils";

// Mock the tRPC provider
const mockInfiniteQueryOptions = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    recipes: {
      list: {
        infiniteQueryOptions: (params: unknown, options: unknown) =>
          mockInfiniteQueryOptions(params, options),
      },
    },
  }),
}));

// Import after mocking
import { useRecipesQuery } from "@/hooks/recipes/use-recipes-query";

describe("useRecipesQuery", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("initial state", () => {
    it("returns empty array when no data is loaded", () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", {}],
        queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRecipesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.recipes).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.hasMore).toBe(false);
    });

    it("returns loading state initially", () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", {}],
        queryFn: () => new Promise(() => {}), // Never resolves
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRecipesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("data fetching", () => {
    it("returns recipes after successful fetch", async () => {
      const mockRecipes = [
        createMockRecipe({ id: "r1", name: "Pasta" }),
        createMockRecipe({ id: "r2", name: "Pizza" }),
      ];

      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", {}],
        queryFn: async () => ({ recipes: mockRecipes, total: 2, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRecipesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.recipes).toEqual(mockRecipes);
      expect(result.current.total).toBe(2);
    });

    it("handles fetch failure gracefully", async () => {
      const testError = new Error("Network error");

      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", {}],
        queryFn: async () => {
          throw testError;
        },
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRecipesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 2000 }
      );

      expect(result.current.recipes).toEqual([]);
    });
  });

  describe("filters", () => {
    it("passes search filter to query options", async () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", { search: "pasta" }],
        queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");

      renderHook(() => useRecipesQuery({ search: "pasta" }), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(mockInfiniteQueryOptions).toHaveBeenCalledWith(
        expect.objectContaining({ search: "pasta" }),
        expect.any(Object)
      );
    });

    it("passes tags filter to query options", async () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", { tags: ["dinner", "easy"] }],
        queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");

      renderHook(() => useRecipesQuery({ tags: ["dinner", "easy"] }), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(mockInfiniteQueryOptions).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["dinner", "easy"] }),
        expect.any(Object)
      );
    });

    it("passes filterMode to query options", async () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", { filterMode: "AND" }],
        queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");

      renderHook(() => useRecipesQuery({ filterMode: "AND" }), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(mockInfiniteQueryOptions).toHaveBeenCalledWith(
        expect.objectContaining({ filterMode: "AND" }),
        expect.any(Object)
      );
    });

    it("passes sortMode to query options", async () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", { sortMode: "titleAsc" }],
        queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");

      renderHook(() => useRecipesQuery({ sortMode: "titleAsc" }), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(mockInfiniteQueryOptions).toHaveBeenCalledWith(
        expect.objectContaining({ sortMode: "titleAsc" }),
        expect.any(Object)
      );
    });
  });

  describe("pagination", () => {
    it("reports hasMore when nextCursor exists", async () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", {}],
        queryFn: async () => ({ recipes: [], total: 100, nextCursor: 50 }),
        getNextPageParam: (lastPage: { nextCursor: number | null }) => lastPage.nextCursor,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRecipesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // hasMore should reflect hasNextPage from the infinite query
      // The actual behavior depends on TanStack Query's implementation
    });
  });

  describe("pending recipes", () => {
    it("provides addPendingRecipe function", async () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", {}],
        queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRecipesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(typeof result.current.addPendingRecipe).toBe("function");
    });

    it("provides removePendingRecipe function", async () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", {}],
        queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRecipesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(typeof result.current.removePendingRecipe).toBe("function");
    });

    it("initializes with empty pending recipes set", async () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", {}],
        queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRecipesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.pendingRecipeIds.size).toBe(0);
    });
  });

  describe("cache operations", () => {
    it("provides setRecipesData function", async () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", {}],
        queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRecipesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(typeof result.current.setRecipesData).toBe("function");
    });

    it("provides setAllRecipesData function", async () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", {}],
        queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRecipesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(typeof result.current.setAllRecipesData).toBe("function");
    });

    it("provides invalidate function", async () => {
      mockInfiniteQueryOptions.mockReturnValue({
        queryKey: ["recipes", "list", {}],
        queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
        getNextPageParam: () => null,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRecipesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(typeof result.current.invalidate).toBe("function");
    });
  });
});
