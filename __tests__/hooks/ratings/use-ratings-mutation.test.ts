import { describe, it, expect, vi, beforeEach } from "vitest";

import { createTestQueryClient, createTestWrapper, createMockUserRatingData } from "./test-utils";

const mockMutationOptions = vi.fn();
const mockQueryKey = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ratings: {
      rate: {
        mutationOptions: (opts: unknown) => {
          mockMutationOptions(opts);

          return opts;
        },
      },
      getUserRating: {
        queryKey: (input: { recipeId: string }) => mockQueryKey(input),
      },
      getAverage: {
        queryKey: (input: { recipeId: string }) => [
          ["ratings", "getAverage"],
          { input, type: "query" },
        ],
      },
    },
  }),
}));

import { useRatingsMutation } from "@/hooks/ratings/use-ratings-mutation";

describe("useRatingsMutation", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  const testRecipeId = "recipe-123";
  const userRatingQueryKey = [
    ["ratings", "getUserRating"],
    { input: { recipeId: testRecipeId }, type: "query" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    mockQueryKey.mockReturnValue(userRatingQueryKey);
  });

  describe("optimistic updates", () => {
    it("optimistically updates user rating", async () => {
      queryClient.setQueryData(userRatingQueryKey, createMockUserRatingData(testRecipeId, null));

      const { renderHook, act } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useRatingsMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      await act(async () => {
        await mutationOpts.onMutate({ recipeId: testRecipeId, rating: 5 });
      });

      const cachedData = queryClient.getQueryData<{ recipeId: string; userRating: number | null }>(
        userRatingQueryKey
      );

      expect(cachedData?.userRating).toBe(5);
    });

    it("updates existing rating", async () => {
      queryClient.setQueryData(userRatingQueryKey, createMockUserRatingData(testRecipeId, 3));

      const { renderHook, act } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useRatingsMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      await act(async () => {
        await mutationOpts.onMutate({ recipeId: testRecipeId, rating: 5 });
      });

      const cachedData = queryClient.getQueryData<{ recipeId: string; userRating: number | null }>(
        userRatingQueryKey
      );

      expect(cachedData?.userRating).toBe(5);
    });
  });

  describe("isRating", () => {
    it("returns false when not rating", () => {
      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRatingsMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isRating).toBe(false);
    });
  });
});
