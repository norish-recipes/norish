/**
 * Ratings land where they are shown, by recipe id, and nothing is refetched
 * for an event the cache already reflects.
 */

import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestWrapper, fakePlatformAdapter } from "@norish/shared-react/platform/testing";

import { trackedCursorMark, trackedEvent } from "../../../__tests__/realtime/tracked-event";
import { useRatingsSubscription } from "../use-ratings-subscription";

const useSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock("@trpc/tanstack-react-query", async () => {
  const actual = await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  );

  return { ...actual, useSubscription: useSubscriptionMock };
});

const LIST_KEY = [["recipes", "list"], { input: {}, type: "infinite" }];
const LIBRARY_KEY = [["library", "list"], { input: {}, type: "infinite" }];
const averageKey = (recipeId?: string) =>
  recipeId
    ? [["ratings", "getAverage"], { input: { recipeId }, type: "query" }]
    : [["ratings", "getAverage"]];
const userRatingKey = (recipeId?: string) =>
  recipeId
    ? [["ratings", "getUserRating"], { input: { recipeId }, type: "query" }]
    : [["ratings", "getUserRating"]];

function procedure(name: string) {
  return {
    subscriptionOptions: (_input: undefined, opts: object) => ({
      name,
      ...opts,
      subscribe: () => ({ unsubscribe: () => undefined }),
    }),
  };
}

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    recipes: {
      list: {
        queryKey: () => [["recipes", "list"], { input: {}, type: "query" }],
        pathKey: () => [["recipes", "list"]],
      },
      getPending: { queryKey: () => [["recipes", "getPending"], { type: "query" }] },
    },
    library: {
      list: {
        queryKey: () => [["library", "list"], { input: {}, type: "query" }],
        pathKey: () => [["library", "list"]],
      },
    },
    cookbooks: { recipes: { pathKey: () => [["cookbooks", "recipes"]] } },
    ratings: {
      getAverage: { queryKey: (input?: { recipeId: string }) => averageKey(input?.recipeId) },
      getUserRating: { queryKey: (input?: { recipeId: string }) => userRatingKey(input?.recipeId) },
      onRatingUpdated: procedure("onRatingUpdated"),
      onRatingFailed: procedure("onRatingFailed"),
    },
  }),
}));

function subscription(name: string) {
  const options = useSubscriptionMock.mock.calls
    .map(
      (call) =>
        call[0] as {
          name: string;
          onData: (data: unknown) => void;
          subscribe: (observer: object) => unknown;
        }
    )
    .findLast((opts) => opts.name === name);

  if (!options) throw new Error(`No subscription named ${name}`);

  return options;
}

function emit(name: string, payload: unknown) {
  act(() => subscription(name).onData(trackedEvent(payload)));
}

let queryClient: QueryClient;
let rendered: ReturnType<typeof renderHook>;
let invalidateQueries: ReturnType<typeof vi.spyOn>;
let platform: ReturnType<typeof fakePlatformAdapter>;

beforeEach(() => {
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
  queryClient.setQueryData(LIBRARY_KEY, {
    pages: [
      {
        items: [
          { kind: "recipe", recipe: { id: "recipe-1", averageRating: null, ratingCount: 0 } },
        ],
        total: 1,
        nextCursor: null,
      },
    ],
    pageParams: [0],
  });
  invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

  platform = fakePlatformAdapter();
  rendered = renderHook(() => useRatingsSubscription(), {
    wrapper: createTestWrapper(queryClient, platform),
  });
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

  it("patches the recipe's Library card too, and rereads the Library once live", () => {
    emit("onRatingUpdated", { recipeId: "recipe-1", averageRating: 4.5, ratingCount: 2 });

    expect(queryClient.getQueryData(LIBRARY_KEY)).toEqual(
      expect.objectContaining({
        pages: [
          expect.objectContaining({
            items: [
              { kind: "recipe", recipe: { id: "recipe-1", averageRating: 4.5, ratingCount: 2 } },
            ],
          }),
        ],
      })
    );

    vi.useFakeTimers();
    try {
      subscription("onRatingUpdated").subscribe({});
      act(() => subscription("onRatingUpdated").onData(trackedCursorMark()));
      act(() => vi.runOnlyPendingTimers());
    } finally {
      vi.useRealTimers();
    }
    expect(queryClient.getQueryState(LIBRARY_KEY)?.isInvalidated).toBe(true);
  });

  it("toasts a failed rating and refetches the user's rating", () => {
    emit("onRatingFailed", { recipeId: "recipe-2", reason: "stale" });

    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "danger",
      title: "common.errors.operationFailed",
      description: "common.errors.technicalDetails",
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: userRatingKey("recipe-2") });
  });
});
