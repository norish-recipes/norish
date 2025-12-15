import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

import { createTestQueryClient, createTestWrapper, createMockFavoritesData } from "./test-utils";

const mockQueryKey = [["favorites", "list"], { type: "query" }];
const mockMutationOptions = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    favorites: {
      toggle: {
        mutationOptions: (opts: unknown) => {
          mockMutationOptions(opts);
          return opts;
        },
      },
    },
  }),
}));

import { useFavoritesMutation } from "@/hooks/favorites/use-favorites-mutation";

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
      const { result } = renderHook(() => useFavoritesMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Get the onMutate callback that was passed to mutationOptions
      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      await act(async () => {
        await mutationOpts.onMutate({ recipeId: "recipe-1" });
      });

      const cachedData = queryClient.getQueryData<{ favoriteIds: string[] }>(mockQueryKey);
      expect(cachedData?.favoriteIds).toContain("recipe-1");
    });

    it("optimistically removes recipe from favorites", async () => {
      queryClient.setQueryData(mockQueryKey, createMockFavoritesData(["recipe-1", "recipe-2"]));

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useFavoritesMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      await act(async () => {
        await mutationOpts.onMutate({ recipeId: "recipe-1" });
      });

      const cachedData = queryClient.getQueryData<{ favoriteIds: string[] }>(mockQueryKey);
      expect(cachedData?.favoriteIds).not.toContain("recipe-1");
      expect(cachedData?.favoriteIds).toContain("recipe-2");
    });

    it("rolls back on error", async () => {
      const initialData = createMockFavoritesData(["recipe-1"]);
      queryClient.setQueryData(mockQueryKey, initialData);

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useFavoritesMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      let context: { previousData: unknown };

      await act(async () => {
        context = await mutationOpts.onMutate({ recipeId: "recipe-2" });
      });

      // Verify optimistic update happened
      let cachedData = queryClient.getQueryData<{ favoriteIds: string[] }>(mockQueryKey);
      expect(cachedData?.favoriteIds).toContain("recipe-2");

      // Simulate error - should rollback
      act(() => {
        mutationOpts.onError(new Error("Failed"), { recipeId: "recipe-2" }, context);
      });

      cachedData = queryClient.getQueryData<{ favoriteIds: string[] }>(mockQueryKey);
      expect(cachedData?.favoriteIds).not.toContain("recipe-2");
      expect(cachedData?.favoriteIds).toContain("recipe-1");
    });

    it("handles empty initial data", async () => {
      // No data in cache initially

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useFavoritesMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      await act(async () => {
        await mutationOpts.onMutate({ recipeId: "recipe-1" });
      });

      const cachedData = queryClient.getQueryData<{ favoriteIds: string[] }>(mockQueryKey);
      expect(cachedData?.favoriteIds).toContain("recipe-1");
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

