import { useFavoritesMutation } from "@/hooks/favorites/use-favorites-mutation";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockFavoritesData, createTestQueryClient, createTestWrapper } from "./test-utils";

const mockQueryKey = [["favorites", "list"], { type: "query" }];
const mockMutationOptions = vi.fn();
const mockMutate = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");

  return {
    ...actual,
    useMutation: vi.fn(() => ({
      mutate: mockMutate,
      isPending: false,
    })),
  };
});

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    favorites: {
      list: {
        queryKey: () => mockQueryKey,
      },
      toggle: {
        mutationOptions: (opts: unknown) => {
          mockMutationOptions(opts);

          return opts;
        },
      },
    },
  }),
}));

describe("useFavoritesMutation", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("toggleFavorite", () => {
    it("optimistically adds recipe to favorites", async () => {
      queryClient.setQueryData(mockQueryKey, createMockFavoritesData([]));

      const { renderHook, act } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useFavoritesMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Get the onMutate callback that was passed to mutationOptions
      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      await act(async () => {
        await mutationOpts.onMutate({ recipeId: "recipe-1", isFavorite: true });
      });

      const cachedData = queryClient.getQueryData<{
        favoriteIds: string[];
        favoriteVersions: Record<string, number>;
      }>(mockQueryKey);

      expect(cachedData?.favoriteIds).toContain("recipe-1");
    });

    it("optimistically removes recipe from favorites", async () => {
      queryClient.setQueryData(
        mockQueryKey,
        createMockFavoritesData(["recipe-1", "recipe-2"], { "recipe-1": 4, "recipe-2": 6 })
      );

      const { renderHook, act } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useFavoritesMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      await act(async () => {
        await mutationOpts.onMutate({ recipeId: "recipe-1", isFavorite: false });
      });

      const cachedData = queryClient.getQueryData<{
        favoriteIds: string[];
        favoriteVersions: Record<string, number>;
      }>(mockQueryKey);

      expect(cachedData?.favoriteIds).not.toContain("recipe-1");
      expect(cachedData?.favoriteIds).toContain("recipe-2");
      expect(cachedData?.favoriteVersions).toEqual({ "recipe-2": 6 });
    });

    it("rolls back on error", async () => {
      const initialData = createMockFavoritesData(["recipe-1"]);

      queryClient.setQueryData(mockQueryKey, initialData);

      const { renderHook, act } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useFavoritesMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      let context: { previousData: unknown };

      await act(async () => {
        context = await mutationOpts.onMutate({ recipeId: "recipe-2", isFavorite: true });
      });

      // Verify optimistic update happened
      let cachedData = queryClient.getQueryData<{
        favoriteIds: string[];
        favoriteVersions: Record<string, number>;
      }>(mockQueryKey);

      expect(cachedData?.favoriteIds).toContain("recipe-2");

      // Simulate error - should rollback
      act(() => {
        mutationOpts.onError(
          new Error("Failed"),
          { recipeId: "recipe-2", isFavorite: true },
          context
        );
      });

      cachedData = queryClient.getQueryData<{
        favoriteIds: string[];
        favoriteVersions: Record<string, number>;
      }>(mockQueryKey);
      expect(cachedData?.favoriteIds).not.toContain("recipe-2");
      expect(cachedData?.favoriteIds).toContain("recipe-1");
    });

    it("keeps the optimistic favorite when the backend is unreachable", async () => {
      const initialData = createMockFavoritesData(["recipe-1"]);

      queryClient.setQueryData(mockQueryKey, initialData);

      const { renderHook, act } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useFavoritesMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      let context: { previousData: unknown };

      await act(async () => {
        context = await mutationOpts.onMutate({ recipeId: "recipe-2", isFavorite: true });
      });

      act(() => {
        mutationOpts.onError(
          new TRPCClientError("Request failed"),
          { recipeId: "recipe-2", isFavorite: true },
          context
        );
      });

      const cachedData = queryClient.getQueryData<{
        favoriteIds: string[];
        favoriteVersions: Record<string, number>;
      }>(mockQueryKey);

      expect(cachedData?.favoriteIds).toContain("recipe-1");
      expect(cachedData?.favoriteIds).toContain("recipe-2");
    });

    it("handles empty initial data", async () => {
      // No data in cache initially

      const { renderHook, act } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useFavoritesMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      await act(async () => {
        await mutationOpts.onMutate({ recipeId: "recipe-1", isFavorite: true });
      });

      const cachedData = queryClient.getQueryData<{
        favoriteIds: string[];
        favoriteVersions: Record<string, number>;
      }>(mockQueryKey);

      expect(cachedData?.favoriteIds).toContain("recipe-1");
    });

    it("sends explicit final state with the cached favorite version", () => {
      queryClient.setQueryData(
        mockQueryKey,
        createMockFavoritesData(["recipe-1"], { "recipe-1": 4 })
      );

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useFavoritesMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.toggleFavorite("recipe-1");
      });

      expect(mockMutate).toHaveBeenCalledWith({
        recipeId: "recipe-1",
        isFavorite: false,
        version: 4,
      });
    });
  });

  describe("isToggling", () => {
    it("returns false when not toggling", () => {
      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useFavoritesMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isToggling).toBe(false);
    });
  });
});
