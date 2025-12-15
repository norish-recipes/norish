import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

import { createTestQueryClient, createTestWrapper, createMockFavoritesData } from "./test-utils";

const mockQueryKey = [["favorites", "list"], { type: "query" }];
const mockQueryOptions = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    favorites: {
      list: {
        queryOptions: () => mockQueryOptions(),
      },
    },
  }),
}));

import { useFavoritesQuery } from "@/hooks/favorites/use-favorites-query";

describe("useFavoritesQuery", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("initial state", () => {
    it("returns empty favoriteIds when no data is loaded", () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockFavoritesData(),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useFavoritesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.favoriteIds).toEqual([]);
    });

    it("returns loading state initially", () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: () => new Promise(() => {}),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useFavoritesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("data fetching", () => {
    it("returns favoriteIds after successful fetch", async () => {
      const mockIds = ["recipe-1", "recipe-2", "recipe-3"];

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockFavoritesData(mockIds),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useFavoritesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favoriteIds).toEqual(mockIds);
    });
  });

  describe("isFavorite", () => {
    it("returns true for favorited recipe", async () => {
      const mockIds = ["recipe-1", "recipe-2"];

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockFavoritesData(mockIds),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useFavoritesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFavorite("recipe-1")).toBe(true);
      expect(result.current.isFavorite("recipe-2")).toBe(true);
    });

    it("returns false for non-favorited recipe", async () => {
      const mockIds = ["recipe-1"];

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockFavoritesData(mockIds),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useFavoritesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFavorite("recipe-999")).toBe(false);
    });
  });

  describe("invalidate", () => {
    it("triggers refetch when invalidate is called", async () => {
      let fetchCount = 0;

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => {
          fetchCount++;
          return createMockFavoritesData(["recipe-1"]);
        },
      });

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useFavoritesQuery(), {
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
});

