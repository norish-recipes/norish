/**
 * Each subscription's `liveQueryKeys` reach every read its events patch or invalidate, driven
 * through the real `useSubscription` with a tRPC stand-in that answers any path.
 */

import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCaldavSubscription } from "../../src/calendar/use-caldav-subscription";
import { usePantrySubscription } from "../../src/groceries/use-pantry-subscription";
import { createTestWrapper } from "../../src/platform/testing";
import { useCookbooksSubscription } from "../../src/recipes/use-cookbooks-subscription";
import { useRecipeShareSubscription } from "../../src/recipes/use-recipe-share-subscription";
import { trackedCursorMark } from "./tracked-event";

type Observer = { onData?: (data: unknown) => void };

const observers: Observer[] = [];

/** A tRPC decoration for any path: keys as tRPC builds them, subscriptions that record. */
function at(path: string[]): unknown {
  const own = {
    pathKey: () => [path],
    pathFilter: () => ({ queryKey: [path] }),
    queryKey: (input?: unknown) =>
      input === undefined ? [path, { type: "query" }] : [path, { input, type: "query" }],
    subscriptionOptions: (_input: undefined, opts: Record<string, unknown>) => ({
      ...opts,
      queryKey: [path, { type: "any" }],
      enabled: "enabled" in opts ? !!opts.enabled : true,
      subscribe: (observer: Observer) => {
        observers.push(observer);

        return { unsubscribe: () => undefined };
      },
    }),
  };

  return new Proxy(own, {
    get: (target, prop: string) =>
      prop in target ? target[prop as keyof typeof own] : at([...path, prop]),
  });
}

const trpc = at([]);

vi.mock("../../src/trpc", () => ({ useTRPC: () => trpc }));

let queryClient: QueryClient;

beforeEach(() => {
  vi.useFakeTimers();
  observers.length = 0;
  queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
});

afterEach(() => {
  vi.useRealTimers();
  queryClient.clear();
});

/** Mounts the hook, marks every subscription live and lets the window flush. */
function goLive(useHook: () => void) {
  renderHook(useHook, { wrapper: createTestWrapper(queryClient) });
  act(() => {
    for (const observer of observers) observer.onData?.(trackedCursorMark());
  });
  act(() => {
    vi.runOnlyPendingTimers();
  });
}

const read = (path: string[], input?: unknown) =>
  input === undefined ? [path, { type: "query" }] : [path, { input, type: "infinite" }];

function expectReread(queryKeys: unknown[][]) {
  for (const queryKey of queryKeys) queryClient.setQueryData(queryKey, []);

  return () => {
    for (const queryKey of queryKeys) {
      expect(queryClient.getQueryState(queryKey)?.isInvalidated, JSON.stringify(queryKey)).toBe(
        true
      );
    }
  };
}

describe("liveQueryKeys", () => {
  it("cookbooks: every cookbook read and the Library", () => {
    const check = expectReread([
      read(["cookbooks", "list"], {}),
      read(["cookbooks", "editable"]),
      [["cookbooks", "get"], { input: { id: "c1" }, type: "query" }],
      read(["cookbooks", "recipes"], { cookbookId: "c1" }),
      [["cookbooks", "memberIds"], { input: { cookbookId: "c1" }, type: "query" }],
      [["cookbooks", "forRecipe"], { input: { recipeId: "r1" }, type: "query" }],
      read(["library", "list"], {}),
    ]);

    goLive(useCookbooksSubscription);
    check();
  });

  it("pantry: the Pantry and the recipe lists filtered by what it covers", () => {
    const check = expectReread([
      read(["pantry", "list"]),
      read(["pantry", "suggestions"]),
      read(["library", "list"], {}),
      read(["cookbooks", "recipes"], { cookbookId: "c1" }),
    ]);

    goLive(usePantrySubscription);
    check();
  });

  it("recipe shares: the recipe's shares, each share, and the reader's and admin's inventories", () => {
    const check = expectReread([
      [["recipes", "shareList"], { input: { recipeId: "r1" }, type: "query" }],
      [["recipes", "shareGet"], { input: { id: "s1" }, type: "query" }],
      read(["recipes", "shareListMine"]),
      read(["recipes", "shareListAdmin"]),
    ]);

    goLive(() => useRecipeShareSubscription("r1"));
    check();
  });

  it("caldav: the config a saved one patches, the statuses and the summary", () => {
    const check = expectReread([
      read(["caldav", "getConfig"]),
      [["caldav", "getSyncStatus"], { input: { page: 2, pageSize: 20 }, type: "query" }],
      read(["caldav", "getSummary"]),
    ]);

    goLive(useCaldavSubscription);
    check();
  });
});
