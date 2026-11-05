import { IMAGE_CACHE_NAME, PAGE_CACHE_NAMES } from "@/lib/offline/cache-names";
import { createWebOfflineEngine, markServerCopies } from "@/lib/offline/engine";
import { createIdbStorage } from "@/lib/offline/idb-storage";
import { PAGES_CACHE_NAME } from "@serwist/turbopack/worker";
import { dehydrate, hydrate, QueryClient, QueryObserver } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";

describe("the web offline engine", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the server's copy as it is until it changes, and refetches any other copy", async () => {
    const { queryClient } = createWebOfflineEngine(createIdbStorage(new IDBFactory()));
    const trpc = createTRPCOptionsProxy<AppRouter>({
      client: createTRPCClient<AppRouter>({ links: [] }),
      queryClient,
    });
    const fetchesOnOpen = async (queryKey: readonly unknown[]) => {
      const queryFn = vi.fn(async () => ({ fetched: true }));
      const leave = new QueryObserver(queryClient, { queryKey, queryFn }).subscribe(() => {});

      await new Promise((resolve) => setTimeout(resolve, 0));
      leave();

      return queryFn.mock.calls.length;
    };
    // The app's own keys, untagged so the test can seed any data.
    const seeded = [...trpc.recipes.get.queryKey({ id: "r1" })];
    const restored = [...trpc.recipes.get.queryKey({ id: "r2" })];
    const kept = [...trpc.recipes.get.queryKey({ id: "r3" })];

    // What QuerySeed hands over: the server's copy of r1, and of r3 in a document the
    // service worker kept from ten minutes ago.
    const server = new QueryClient();

    server.setQueryData(seeded, { id: "r1" });
    server.setQueryData(kept, { id: "r3" }, { updatedAt: Date.now() - 10 * 60 * 1000 });
    const state = dehydrate(server);

    markServerCopies(state);
    hydrate(queryClient, state);
    // r2 is as fresh, but from the Offline Cache: it may predate a change made elsewhere.
    queryClient.setQueryData(restored, { id: "r2" });

    expect(await fetchesOnOpen(seeded)).toBe(0);
    expect(await fetchesOnOpen(restored)).toBe(1);
    expect(await fetchesOnOpen(kept)).toBe(1);

    // Once the server's copy has changed, it refetches on mount like any other.
    queryClient.setQueryData(seeded, { id: "r1", edited: true });

    expect(await fetchesOnOpen(seeded)).toBe(1);
  });

  it("resets the service worker's image and page caches with the read copy", async () => {
    const deletedCaches: string[] = [];

    vi.stubGlobal("caches", {
      delete: vi.fn(async (name: string) => {
        deletedCaches.push(name);

        return true;
      }),
    });

    const { cache } = createWebOfflineEngine(createIdbStorage(new IDBFactory()));

    await cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await cache.resetOfflineCopy("manual");

    // A recipe page's document carries its recipe, so the service worker's page caches go too.
    expect(PAGE_CACHE_NAMES).toEqual(Object.values(PAGES_CACHE_NAME));
    expect(deletedCaches).toEqual([IMAGE_CACHE_NAME, ...PAGE_CACHE_NAMES]);
  });
});
