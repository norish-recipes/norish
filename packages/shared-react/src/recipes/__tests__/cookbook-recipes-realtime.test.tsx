/**
 * A cookbook page draws its members with the Library's recipe card, so the recipe events that
 * patch the Library's cards patch an open cookbook's too, and a fresh subscription rereads it.
 */

import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import type { AppRouter } from "@norish/trpc/client";
import { createTestWrapper, fakePlatformAdapter } from "@norish/shared-react/platform/testing";

import type { InfiniteRecipeData } from "../library-cache";
import { trackedCursorMark, trackedEvent } from "../../../__tests__/realtime/tracked-event";
import { useRatingsSubscription } from "../use-ratings-subscription";
import {
  useRecipeListSubscription,
  useRecipeOutcomesSubscription,
} from "../use-recipes-subscription";

const useSubscriptionMock = vi.hoisted(() => vi.fn());
const proxy = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("@trpc/tanstack-react-query", async () => {
  const actual = await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  );

  return { ...actual, useSubscription: useSubscriptionMock };
});

vi.mock("../../trpc", () => ({ useTRPC: () => proxy.current }));

type SubscriptionOptions = {
  queryKey: [string[], ...unknown[]];
  onData: (data: unknown) => void;
  subscribe: (observer: object) => unknown;
};

let queryClient: QueryClient;
let trpc: ReturnType<typeof createTRPCOptionsProxy<AppRouter>>;
let rendered: ReturnType<typeof renderHook>;

const cookbookKey = () =>
  trpc.cookbooks.recipes.infiniteQueryOptions({ cookbookId: "c1" }).queryKey;

function card(overrides: Partial<RecipeDashboardDTO> = {}): RecipeDashboardDTO {
  return {
    id: "recipe-1",
    userId: "user-1",
    name: "Before",
    averageRating: null,
    ratingCount: 0,
    version: 1,
    ...overrides,
  } as RecipeDashboardDTO;
}

/** The subscription for one procedure, e.g. "ratings.onRatingUpdated". */
function subscription(path: string) {
  const options = useSubscriptionMock.mock.calls
    .map(([options]) => options as SubscriptionOptions)
    .findLast((opts) => opts.queryKey[0].join(".") === path);

  if (!options) throw new Error(`No subscription for ${path}`);

  return options;
}

function emit(path: string, payload: unknown) {
  act(() => subscription(path).onData(trackedEvent(payload)));
}

function members() {
  return queryClient.getQueryData<InfiniteRecipeData>(cookbookKey())?.pages[0];
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  trpc = createTRPCOptionsProxy<AppRouter>({
    // A link that never answers: only the key builders and the subscribe are used.
    client: createTRPCClient<AppRouter>({ links: [() => () => observable(() => () => undefined)] }),
    queryClient,
  });
  proxy.current = trpc;
  queryClient.setQueryData(cookbookKey(), {
    pages: [{ recipes: [card(), card({ id: "recipe-2" })], total: 2, nextCursor: null }],
    pageParams: [0],
  });
  rendered = renderHook(
    () => {
      useRatingsSubscription();
      useRecipeListSubscription();
      useRecipeOutcomesSubscription();
    },
    { wrapper: createTestWrapper(queryClient, fakePlatformAdapter()) }
  );
});

afterEach(() => {
  rendered.unmount();
  vi.useRealTimers();
  queryClient.clear();
});

describe("a cookbook's members under recipe events", () => {
  it("takes a rating in place", () => {
    emit("ratings.onRatingUpdated", { recipeId: "recipe-1", averageRating: 4.5, ratingCount: 2 });

    expect(members()?.recipes[0]).toEqual(card({ averageRating: 4.5, ratingCount: 2 }));
  });

  it("takes an edit in place", () => {
    emit("recipes.onUpdated", {
      recipe: { ...card({ name: "After", version: 2 }), recipeIngredients: [] } as FullRecipeDTO,
      source: "user",
    });

    expect(members()?.recipes[0]?.name).toBe("After");
  });

  it("drops a deleted recipe and counts it out of the total", () => {
    emit("recipes.onDeleted", { ids: ["recipe-1"] });

    expect(members()).toEqual({ recipes: [card({ id: "recipe-2" })], total: 1, nextCursor: null });
  });

  it("gains no recipe that was created or imported, since neither files it in the cookbook", () => {
    emit("recipes.onCreated", { recipe: card({ id: "recipe-3" }) });
    emit("recipes.onImported", { recipe: card({ id: "recipe-4" }) });

    expect(members()).toEqual({
      recipes: [card(), card({ id: "recipe-2" })],
      total: 2,
      nextCursor: null,
    });
  });

  it("is reread when an import fails", () => {
    emit("recipes.onFailed", {});

    expect(queryClient.getQueryState(cookbookKey())?.isInvalidated).toBe(true);
  });

  it.each(["ratings.onRatingUpdated", "recipes.onUpdated", "recipes.onImported"])(
    "is reread once %s's subscription is live",
    (path) => {
      vi.useFakeTimers();
      subscription(path).subscribe({});
      act(() => subscription(path).onData(trackedCursorMark()));
      act(() => vi.runOnlyPendingTimers());

      expect(queryClient.getQueryState(cookbookKey())?.isInvalidated).toBe(true);
    }
  );
});
