/**
 * A policy change, and the subscription going live, reread which recipes the reader may see:
 * the paged lists are cached only as infinite queries, under tRPC's own keys.
 */

import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";
import { createTestWrapper, fakePlatformAdapter } from "@norish/shared-react/platform/testing";

import { trackedCursorMark, trackedEvent } from "../../../__tests__/realtime/tracked-event";
import { usePermissionsSubscription } from "../use-permissions";

const useSubscriptionMock = vi.hoisted(() => vi.fn());
const proxy = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("@trpc/tanstack-react-query", async () => {
  const actual = await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  );

  return { ...actual, useSubscription: useSubscriptionMock };
});

vi.mock("../../trpc", () => ({ useTRPC: () => proxy.current }));

let queryClient: QueryClient;
let trpc: ReturnType<typeof createTRPCOptionsProxy<AppRouter>>;

/** The lists as the screens cache them: infinite queries, one per set of filters. */
function listKeys() {
  return [
    trpc.recipes.list.infiniteQueryOptions({}).queryKey,
    trpc.library.list.infiniteQueryOptions({}).queryKey,
    trpc.cookbooks.recipes.infiniteQueryOptions({ cookbookId: "c1" }).queryKey,
  ];
}

function subscription() {
  const options = useSubscriptionMock.mock.calls.at(-1)?.[0] as {
    onData: (data: unknown) => void;
    subscribe: (observer: object) => unknown;
  };

  return options;
}

function rereads() {
  return listKeys().map((key) => queryClient.getQueryState(key)?.isInvalidated);
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  trpc = createTRPCOptionsProxy<AppRouter>({
    // A link that never answers: only the key builders and the subscribe are used.
    client: createTRPCClient<AppRouter>({ links: [() => () => observable(() => () => undefined)] }),
    queryClient,
  });
  proxy.current = trpc;
  for (const key of listKeys()) queryClient.setQueryData(key, { pages: [], pageParams: [] });
  renderHook(() => usePermissionsSubscription(), {
    wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
  });
});

afterEach(() => {
  vi.useRealTimers();
  queryClient.clear();
});

describe("usePermissionsSubscription", () => {
  it("rereads every paged recipe list on a policy change", () => {
    act(() => subscription().onData(trackedEvent({})));

    expect(rereads()).toEqual([true, true, true]);
  });

  it("rereads every paged recipe list once live", () => {
    vi.useFakeTimers();
    subscription().subscribe({});
    act(() => subscription().onData(trackedCursorMark()));
    act(() => vi.runOnlyPendingTimers());

    expect(rereads()).toEqual([true, true, true]);
  });
});
