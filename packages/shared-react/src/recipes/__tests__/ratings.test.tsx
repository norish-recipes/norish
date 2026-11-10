import { act, renderHook, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useRatingQuery } from "../use-rating-query";
import { useRatingsMutation } from "../use-ratings-mutation";

type UserRating = { recipeId: string; userRating: number | null; version: number | null };
type AverageRating = { recipeId: string; averageRating: number | null; ratingCount: number };

const server = vi.hoisted(() => ({
  getAverage: vi.fn<(input: { recipeId: string }) => Promise<AverageRating>>(),
  getUserRating: vi.fn<(input: { recipeId: string }) => Promise<UserRating>>(),
  rate: vi.fn<(input: unknown) => Promise<unknown>>(),
}));

vi.mock("../../trpc", () => {
  const key = (path: string) => (input: unknown) => [["ratings", path], { input, type: "query" }];
  const read = (path: "getAverage" | "getUserRating") => ({
    queryKey: key(path),
    queryOptions: (input: { recipeId: string }) => ({
      queryKey: key(path)(input),
      queryFn: () => server[path](input),
    }),
  });

  return {
    useTRPC: () => ({
      ratings: {
        getAverage: read("getAverage"),
        getUserRating: read("getUserRating"),
        rate: { mutationOptions: (options: object) => ({ ...options, mutationFn: server.rate }) },
      },
    }),
  };
});

const RECIPE = "recipe-123";
const USER_KEY = [["ratings", "getUserRating"], { input: { recipeId: RECIPE }, type: "query" }];

describe("useRatingQuery", () => {
  beforeEach(() => {
    server.getAverage.mockReset();
    server.getUserRating.mockReset();
  });

  const render = () =>
    renderHook(() => useRatingQuery(RECIPE), {
      wrapper: createTestWrapper(createTestQueryClient()),
    }).result;

  it("reads the average, the count and the reader's own rating", async () => {
    server.getAverage.mockResolvedValue({ recipeId: RECIPE, averageRating: 4.5, ratingCount: 10 });
    server.getUserRating.mockResolvedValue({ recipeId: RECIPE, userRating: 5, version: 7 });
    const result = render();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.averageRating).toBeNull();
    expect(result.current.ratingCount).toBe(0);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({
      averageRating: 4.5,
      ratingCount: 10,
      userRating: 5,
      userRatingVersion: 7,
    });
  });

  it("reads no rating for a reader or recipe nobody rated", async () => {
    server.getAverage.mockResolvedValue({ recipeId: RECIPE, averageRating: null, ratingCount: 0 });
    server.getUserRating.mockResolvedValue({ recipeId: RECIPE, userRating: null, version: null });
    const result = render();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toMatchObject({
      averageRating: null,
      ratingCount: 0,
      userRating: null,
      userRatingVersion: undefined,
    });
  });
});

describe("useRatingsMutation", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let answer: PromiseWithResolvers<unknown>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    answer = Promise.withResolvers();
    server.rate.mockReset().mockImplementation(() => answer.promise);
  });

  const render = () =>
    renderHook(() => useRatingsMutation(), { wrapper: createTestWrapper(queryClient) }).result;
  const cached = () => queryClient.getQueryData<UserRating>(USER_KEY);
  const settled = () => waitFor(() => expect(queryClient.isMutating()).toBe(0));

  it("rates at once, a version on, and sends the version it was read at", async () => {
    queryClient.setQueryData<UserRating>(USER_KEY, { recipeId: RECIPE, userRating: 3, version: 9 });
    const result = render();

    act(() => result.current.rateRecipe(RECIPE, 4));

    await waitFor(() => expect(cached()).toEqual({ recipeId: RECIPE, userRating: 4, version: 10 }));
    expect(server.rate).toHaveBeenCalledWith(
      { recipeId: RECIPE, rating: 4, version: 9 },
      expect.anything()
    );
  });

  it("rates a recipe the reader had not rated", async () => {
    queryClient.setQueryData<UserRating>(USER_KEY, {
      recipeId: RECIPE,
      userRating: null,
      version: null,
    });
    const result = render();

    act(() => result.current.rateRecipe(RECIPE, 5));

    await waitFor(() => expect(cached()?.userRating).toBe(5));
    expect(server.rate).toHaveBeenCalledWith(
      { recipeId: RECIPE, rating: 5, version: undefined },
      expect.anything()
    );
  });

  it("clears the rating with null", async () => {
    queryClient.setQueryData<UserRating>(USER_KEY, { recipeId: RECIPE, userRating: 4, version: 3 });
    const result = render();

    act(() => result.current.rateRecipe(RECIPE, null));

    await waitFor(() =>
      expect(cached()).toEqual({ recipeId: RECIPE, userRating: null, version: 4 })
    );
    expect(server.rate).toHaveBeenCalledWith(
      { recipeId: RECIPE, rating: null, version: 3 },
      expect.anything()
    );
  });

  it("puts the rating back when the write fails", async () => {
    queryClient.setQueryData<UserRating>(USER_KEY, { recipeId: RECIPE, userRating: 3, version: 9 });
    const result = render();

    act(() => result.current.rateRecipe(RECIPE, 5));
    await waitFor(() => expect(cached()?.userRating).toBe(5));
    await act(async () => answer.reject(new Error("Failed")));
    await settled();

    expect(cached()).toEqual({ recipeId: RECIPE, userRating: 3, version: 9 });
  });

  it("keeps the rating when the backend is unreachable and the write is queued", async () => {
    queryClient.setQueryData<UserRating>(USER_KEY, { recipeId: RECIPE, userRating: 3, version: 9 });
    const result = render();

    act(() => result.current.rateRecipe(RECIPE, 5));
    await waitFor(() => expect(cached()?.userRating).toBe(5));
    await act(async () => answer.reject(new TRPCClientError("Request failed")));
    await settled();

    expect(cached()).toEqual({ recipeId: RECIPE, userRating: 5, version: 10 });
  });

  it("is rating while the write is on its way", async () => {
    const result = render();

    expect(result.current.isRating).toBe(false);
    act(() => result.current.rateRecipe(RECIPE, 4));
    await waitFor(() => expect(result.current.isRating).toBe(true));
    await act(async () => answer.resolve({}));
    await waitFor(() => expect(result.current.isRating).toBe(false));
  });
});
