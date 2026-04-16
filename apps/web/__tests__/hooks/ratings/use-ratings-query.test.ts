import { useRatingQuery } from "@/hooks/ratings/use-ratings-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockAverageRatingData,
  createMockUserRatingData,
  createTestQueryClient,
  createTestWrapper,
} from "./test-utils";

const mockAverageQueryOptions = vi.fn();
const mockUserRatingQueryOptions = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ratings: {
      getAverage: {
        queryOptions: (input: { recipeId: string }) => mockAverageQueryOptions(input),
      },
      getUserRating: {
        queryOptions: (input: { recipeId: string }) => mockUserRatingQueryOptions(input),
      },
    },
  }),
}));

describe("useRatingQuery", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  const testRecipeId = "recipe-123";

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("initial state", () => {
    it("returns null ratings when no data is loaded", () => {
      mockAverageQueryOptions.mockReturnValue({
        queryKey: [["ratings", "getAverage"], { input: { recipeId: testRecipeId } }],
        queryFn: async () => createMockAverageRatingData(testRecipeId),
      });
      mockUserRatingQueryOptions.mockReturnValue({
        queryKey: [["ratings", "getUserRating"], { input: { recipeId: testRecipeId } }],
        queryFn: async () => createMockUserRatingData(testRecipeId),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRatingQuery(testRecipeId), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.averageRating).toBeNull();
      expect(result.current.userRating).toBeNull();
      expect(result.current.userRatingVersion).toBeUndefined();
      expect(result.current.ratingCount).toBe(0);
    });

    it("returns loading state initially", () => {
      mockAverageQueryOptions.mockReturnValue({
        queryKey: [["ratings", "getAverage"], { input: { recipeId: testRecipeId } }],
        queryFn: () => new Promise(() => {}),
      });
      mockUserRatingQueryOptions.mockReturnValue({
        queryKey: [["ratings", "getUserRating"], { input: { recipeId: testRecipeId } }],
        queryFn: () => new Promise(() => {}),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRatingQuery(testRecipeId), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("data fetching", () => {
    it("returns rating data after successful fetch", async () => {
      mockAverageQueryOptions.mockReturnValue({
        queryKey: [["ratings", "getAverage"], { input: { recipeId: testRecipeId } }],
        queryFn: async () => createMockAverageRatingData(testRecipeId, 4.5, 10),
      });
      mockUserRatingQueryOptions.mockReturnValue({
        queryKey: [["ratings", "getUserRating"], { input: { recipeId: testRecipeId } }],
        queryFn: async () => createMockUserRatingData(testRecipeId, 5, 7),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRatingQuery(testRecipeId), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.averageRating).toBe(4.5);
      expect(result.current.ratingCount).toBe(10);
      expect(result.current.userRating).toBe(5);
      expect(result.current.userRatingVersion).toBe(7);
    });

    it("handles user with no rating", async () => {
      mockAverageQueryOptions.mockReturnValue({
        queryKey: [["ratings", "getAverage"], { input: { recipeId: testRecipeId } }],
        queryFn: async () => createMockAverageRatingData(testRecipeId, 3.5, 5),
      });
      mockUserRatingQueryOptions.mockReturnValue({
        queryKey: [["ratings", "getUserRating"], { input: { recipeId: testRecipeId } }],
        queryFn: async () => createMockUserRatingData(testRecipeId, null),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRatingQuery(testRecipeId), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.averageRating).toBe(3.5);
      expect(result.current.userRating).toBeNull();
    });

    it("handles recipe with no ratings", async () => {
      mockAverageQueryOptions.mockReturnValue({
        queryKey: [["ratings", "getAverage"], { input: { recipeId: testRecipeId } }],
        queryFn: async () => createMockAverageRatingData(testRecipeId, null, 0),
      });
      mockUserRatingQueryOptions.mockReturnValue({
        queryKey: [["ratings", "getUserRating"], { input: { recipeId: testRecipeId } }],
        queryFn: async () => createMockUserRatingData(testRecipeId, null),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useRatingQuery(testRecipeId), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.averageRating).toBeNull();
      expect(result.current.ratingCount).toBe(0);
    });
  });
});
