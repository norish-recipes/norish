/**
 * Ratings land where they are shown, by recipe id, and nothing is refetched
 * for an event the cache already reflects.
 */

import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateRecipeHooksOptions } from "../../src/hooks/recipes/types";
import { createUseRatingsSubscription } from "../../src/hooks/recipes/dashboard/use-ratings-subscription";
import { trackedEvent } from "../realtime/tracked-event";
import { renderHookWithClient } from "./render-hook";

const useSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock("@trpc/tanstack-react-query", async () => {
  const actual = await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  );

  return { ...actual, useSubscription: useSubscriptionMock };
});

const LIST_KEY = [["recipes", "list"], { input: {}, type: "infinite" }];
const averageKey = (recipeId?: string) =>
  recipeId
    ? [["ratings", "getAverage"], { input: { recipeId }, type: "query" }]
    : [["ratings", "getAverage"]];
const userRatingKey = (recipeId?: string) =>
  recipeId
    ? [["ratings", "getUserRating"], { input: { recipeId }, type: "query" }]
    : [["ratings", "getUserRating"]];

function procedure(name: string) {
  return { subscriptionOptions: (_input: undefined, opts: object) => ({ name, ...opts }) };
}

const useTRPC = (() => ({
  recipes: {
    list: { queryKey: () => [["recipes", "list"], { input: {}, type: "query" }] },
  },
  ratings: {
    getAverage: { queryKey: (input?: { recipeId: string }) => averageKey(input?.recipeId) },
    getUserRating: { queryKey: (input?: { recipeId: string }) => userRatingKey(input?.recipeId) },
    onRatingUpdated: procedure("onRatingUpdated"),
    onRatingFailed: procedure("onRatingFailed"),
  },
})) as unknown as CreateRecipeHooksOptions["useTRPC"];

function emit(name: string, payload: unknown) {
  const options = useSubscriptionMock.mock.calls
    .map((call) => call[0] as { name: string; onData: (data: unknown) => void })
    .find((opts) => opts.name === name);

  if (!options) throw new Error(`No subscription named ${name}`);

  act(() => options.onData(trackedEvent(payload)));
}

let queryClient: QueryClient;
let rendered: ReturnType<typeof renderHookWithClient>;
let invalidateQueries: ReturnType<typeof vi.spyOn>;
const onRatingFailed = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(LIST_KEY, {
    pages: [
      {
        recipes: [
          { id: "recipe-1", averageRating: null, ratingCount: 0 },
          { id: "recipe-2", averageRating: 3, ratingCount: 1 },
        ],
        total: 2,
        nextCursor: null,
      },
    ],
    pageParams: [0],
  });
  invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

  const useRatingsSubscription = createUseRatingsSubscription({ useTRPC });

  rendered = renderHookWithClient(queryClient, () => useRatingsSubscription({ onRatingFailed }));
});

afterEach(() => {
  rendered.unmount();
  queryClient.clear();
});

describe("useRatingsSubscription", () => {
  it("patches the average and the dashboard row in place, and refetches only the user's own rating", () => {
    emit("onRatingUpdated", { recipeId: "recipe-1", averageRating: 4.5, ratingCount: 2 });

    expect(queryClient.getQueryData(averageKey("recipe-1"))).toEqual({
      recipeId: "recipe-1",
      averageRating: 4.5,
      ratingCount: 2,
    });
    expect(queryClient.getQueryData(LIST_KEY)).toEqual(
      expect.objectContaining({
        pages: [
          expect.objectContaining({
            recipes: [
              { id: "recipe-1", averageRating: 4.5, ratingCount: 2 },
              { id: "recipe-2", averageRating: 3, ratingCount: 1 },
            ],
          }),
        ],
      })
    );
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: userRatingKey("recipe-1") });
  });

  it("hands a failed rating to the callback and refetches the user's rating", () => {
    emit("onRatingFailed", { recipeId: "recipe-2", reason: "stale" });

    expect(onRatingFailed).toHaveBeenCalledWith({ recipeId: "recipe-2", reason: "stale" });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: userRatingKey("recipe-2") });
  });
});
