import { useRatingsMutation } from "@/hooks/ratings/use-ratings-mutation";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockUserRatingData, createTestQueryClient, createTestWrapper } from "./test-utils";

const mockMutationOptions = vi.fn();
const mockQueryKey = vi.fn();
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
      queryClient.setQueryData(
        userRatingQueryKey,
        createMockUserRatingData(testRecipeId, null, null)
      );

      const { renderHook, act } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useRatingsMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      await act(async () => {
        await mutationOpts.onMutate({ recipeId: testRecipeId, rating: 5 });
      });

      const cachedData = queryClient.getQueryData<{
        recipeId: string;
        userRating: number | null;
        version?: number | null;
      }>(userRatingQueryKey);

      expect(cachedData?.userRating).toBe(5);
    });

    it("updates existing rating", async () => {
      queryClient.setQueryData(userRatingQueryKey, createMockUserRatingData(testRecipeId, 3, 9));

      const { renderHook, act } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useRatingsMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      await act(async () => {
        await mutationOpts.onMutate({ recipeId: testRecipeId, rating: 5 });
      });

      const cachedData = queryClient.getQueryData<{
        recipeId: string;
        userRating: number | null;
        version?: number | null;
      }>(userRatingQueryKey);

      expect(cachedData?.userRating).toBe(5);
      expect(cachedData?.version).toBe(10);
    });

    it("keeps the optimistic rating when the backend is unreachable", async () => {
      queryClient.setQueryData(userRatingQueryKey, createMockUserRatingData(testRecipeId, 3, 9));

      const { renderHook, act } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useRatingsMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      let context:
        | {
            previousUserRating: {
              recipeId: string;
              userRating: number | null;
              version: number | null;
            };
            userRatingQueryKey: unknown;
            averageRatingQueryKey: unknown;
          }
        | undefined;

      await act(async () => {
        context = await mutationOpts.onMutate({ recipeId: testRecipeId, rating: 5 });
      });

      act(() => {
        mutationOpts.onError(
          new TRPCClientError("Request failed"),
          { recipeId: testRecipeId, rating: 5 },
          context
        );
      });

      const cachedData = queryClient.getQueryData<{
        recipeId: string;
        userRating: number | null;
        version?: number | null;
      }>(userRatingQueryKey);

      expect(cachedData?.userRating).toBe(5);
      expect(cachedData?.version).toBe(10);
    });

    it("rolls the optimistic rating back for a handled mutation error", async () => {
      queryClient.setQueryData(userRatingQueryKey, createMockUserRatingData(testRecipeId, 3, 9));

      const { renderHook, act } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useRatingsMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      const mutationOpts = mockMutationOptions.mock.calls[0][0];
      const context = await mutationOpts.onMutate({ recipeId: testRecipeId, rating: 5 });

      act(() => {
        mutationOpts.onError(
          new Error("Request failed"),
          { recipeId: testRecipeId, rating: 5 },
          context
        );
      });

      expect(queryClient.getQueryData(userRatingQueryKey)).toEqual(
        createMockUserRatingData(testRecipeId, 3, 9)
      );
    });

    it("sends the cached version with the explicit final rating", async () => {
      queryClient.setQueryData(userRatingQueryKey, createMockUserRatingData(testRecipeId, 3, 9));

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useRatingsMutation(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.rateRecipe(testRecipeId, 4);
      });

      expect(mockMutate).toHaveBeenCalledWith({ recipeId: testRecipeId, rating: 4, version: 9 });
    });
  });

  describe("acknowledgement reconciliation", () => {
    it("invalidates only rating queries after a stale acknowledgement", () => {
      const { renderHook } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useRatingsMutation(), {
        wrapper: createTestWrapper(queryClient),
      });
      const averageRatingQueryKey = [
        ["ratings", "getAverage"],
        { input: { recipeId: testRecipeId }, type: "query" },
      ];
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      mutationOpts.onSuccess(
        { success: true, applied: false, stale: true },
        { recipeId: testRecipeId, rating: 5 },
        { userRatingQueryKey, averageRatingQueryKey }
      );

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: userRatingQueryKey });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: averageRatingQueryKey });
    });

    it("does not refetch after an applied acknowledgement", () => {
      const { renderHook } = require("@testing-library/react");
      const { result: _result } = renderHook(() => useRatingsMutation(), {
        wrapper: createTestWrapper(queryClient),
      });
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
      const mutationOpts = mockMutationOptions.mock.calls[0][0];

      mutationOpts.onSuccess(
        { success: true, applied: true },
        { recipeId: testRecipeId, rating: 5 },
        { userRatingQueryKey, averageRatingQueryKey: [] }
      );

      expect(invalidateQueries).not.toHaveBeenCalled();
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
