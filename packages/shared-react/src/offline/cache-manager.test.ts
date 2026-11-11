import type { PersistedClient } from "@tanstack/query-persist-client-core";
import { dehydrate, QueryClient, QueryObserver } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";

import type { OfflineStorage } from "./storage";
import { queryCacheKey } from "./cache-identity";
import { CACHE_MAX_AGE_MS, createCacheManager } from "./cache-manager";
import { readLastWarmedAt, writeLastWarmedAt } from "./last-warmed";
import { createMemoryStorage } from "./testing/memory-storage";

const CACHE_BUSTER = "0.0.0-test";

/** Build a valid persisted cache blob holding a single successful query. */
function seedClient(key: unknown[], value: unknown): PersistedClient {
  const source = new QueryClient();

  source.setQueryData(key, value);

  return { timestamp: Date.now(), buster: CACHE_BUSTER, clientState: dehydrate(source) };
}

async function seedOwnerCache(
  storage: OfflineStorage,
  owner: string,
  key: unknown[],
  value: unknown
): Promise<void> {
  await storage.keyval.set(queryCacheKey(owner), seedClient(key, value));
}

describe("createCacheManager", () => {
  let storage: OfflineStorage;
  const createManager = () => createCacheManager({ storage, buster: CACHE_BUSTER });

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing while the online session is still unresolved", async () => {
    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: null, isOffline: false });

    expect(manager.owner()).toBeNull();
    expect(manager.queryClient.getQueryData(["greeting"])).toBeUndefined();
  });

  it("restores the confirmed user's persisted cache", async () => {
    await seedOwnerCache(storage, "u1", ["greeting"], "hello");
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });

    expect(manager.owner()).toBe("u1");
    expect(manager.queryClient.getQueryData(["greeting"])).toBe("hello");
  });

  it("restores from the last-known owner while Offline, without a session", async () => {
    await seedOwnerCache(storage, "u1", ["greeting"], "cached-while-offline");
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: null, isOffline: true });

    expect(manager.owner()).toBe("u1");
    expect(manager.queryClient.getQueryData(["greeting"])).toBe("cached-while-offline");
  });

  it("purges the departed user's cache and never surfaces it on an account switch", async () => {
    await seedOwnerCache(storage, "u1", ["greeting"], "u1-secret");
    await writeLastWarmedAt("u1", 123, storage.keyval);
    storage.lastOwner.set("u1");

    const manager = createManager();

    // A different user signs in on the same browser.
    await manager.reconcileIdentity({ sessionUserId: "u2", isOffline: false });

    expect(manager.owner()).toBe("u2");
    // u1's data is gone from both the live client and IndexedDB.
    expect(manager.queryClient.getQueryData(["greeting"])).toBeUndefined();
    expect(await storage.keyval.get(queryCacheKey("u1"))).toBeUndefined();
    expect(await readLastWarmedAt("u1", storage.keyval)).toBeNull();
    // The new owner is recorded as the cache owner.
    expect(storage.lastOwner.get()).toBe("u2");
  });

  it("adopts a first owner without a purge and starts persisting under their key", async () => {
    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    manager.queryClient.setQueryData(["k"], "v");

    // Give the persist subscription a tick to flush.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(manager.owner()).toBe("u1");
    expect(await storage.keyval.get(queryCacheKey("u1"))).toBeDefined();
  });

  it("restores last successful data after background refetches fail", async () => {
    const manager = createManager();
    const cachedReads = [
      {
        key: [["groceries", "list"], { type: "query" }],
        value: { items: [{ id: "g1", name: "Oat milk" }] },
      },
      {
        key: [
          ["calendar", "listItems"],
          { input: { startISO: "2026-07-27", endISO: "2026-08-03" }, type: "query" },
        ],
        value: [{ id: "plan-1", recipeId: "r1" }],
      },
      {
        key: [["recipes", "list"], { input: {}, type: "infinite" }],
        value: { pages: [{ items: [{ id: "r1", name: "Soup" }] }], pageParams: [null] },
      },
      {
        key: [["recipes", "get"], { input: { id: "r1" }, type: "query" }],
        value: { id: "r1", name: "Soup" },
      },
      {
        key: [["user", "get"], { type: "query" }],
        value: { id: "u1", name: "Offline User" },
      },
    ] as const;

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });

    for (const { key, value } of cachedReads) {
      manager.queryClient.setQueryData(key, value);
      await expect(
        manager.queryClient.fetchQuery({
          queryKey: key,
          queryFn: () => Promise.reject(new Error("backend unavailable")),
          retry: false,
          staleTime: 0,
        })
      ).rejects.toThrow("backend unavailable");
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    const restored = createManager();

    await restored.reconcileIdentity({ sessionUserId: null, isOffline: true });

    for (const { key, value } of cachedReads) {
      expect(restored.queryClient.getQueryData(key)).toEqual(value);
    }
  });

  it("never persists a mutation waiting behind another in its scope (the Outbox is the queue)", async () => {
    const manager = createManager();
    const scope = { id: "plan-writes" };
    const first = Promise.withResolvers<void>();
    const mutate = (mutationFn: () => Promise<void>) =>
      manager.queryClient.getMutationCache().build(manager.queryClient, { mutationFn, scope });

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    void mutate(() => first.promise).execute(undefined);
    const waiting = mutate(() => Promise.resolve());

    void waiting.execute(undefined);
    manager.queryClient.setQueryData(["k"], "v");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(waiting.state.isPaused).toBe(true);
    const persisted = await storage.keyval.get<PersistedClient>(queryCacheKey("u1"));

    expect(persisted?.clientState.mutations).toEqual([]);
    first.resolve();
  });

  it("does not restore a query whose initial request failed without data", async () => {
    const manager = createManager();
    const failedKey = [["groceries", "list"], { type: "query" }] as const;

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await expect(
      manager.queryClient.fetchQuery({
        queryKey: failedKey,
        queryFn: () => Promise.reject(new Error("backend unavailable")),
        retry: false,
      })
    ).rejects.toThrow("backend unavailable");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const restored = createManager();

    await restored.reconcileIdentity({ sessionUserId: null, isOffline: true });

    expect(restored.queryClient.getQueryState(failedKey)).toBeUndefined();
  });

  it("restores entries at the cache's own maxAge as their gcTime (ADR-0008 durability)", async () => {
    await seedOwnerCache(storage, "u1", ["recipes", "get", "r1"], { id: "r1" });
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });

    // Dehydration drops per-query gcTime, so without the hydrate-time floor this
    // would be the 10-minute default — and a warmed entry would be GC'd and fall
    // out of the next persist, not surviving a second Offline reload.
    const query = manager.queryClient.getQueryCache().find({ queryKey: ["recipes", "get", "r1"] });

    expect(query?.gcTime).toBe(CACHE_MAX_AGE_MS);
  });

  it("holds a recipe, a cookbook, the groceries list's reads and the Library past the default gcTime (ADR-0008)", async () => {
    vi.useFakeTimers();

    const { queryClient } = createManager();
    // The app's own keys, so this proves the held paths match what tRPC builds.
    const trpc = createTRPCOptionsProxy<AppRouter>({
      client: createTRPCClient<AppRouter>({ links: [] }),
      queryClient,
    });
    const opened = [
      trpc.recipes.get.queryKey({ id: "r1" }),
      trpc.cookbooks.get.queryKey({ id: "c1" }),
      // Unobserved while the Pantry view shows.
      trpc.groceries.list.queryKey(),
      trpc.stores.list.queryKey(),
      trpc.stores.groceryPrices.queryKey(),
      trpc.stores.aisleLinks.queryKey(),
      // Unobserved once a surface's set changes, while its icons still show it.
      trpc.ingredients.icons.queryKey({ ids: ["i1"] }),
      // Unobserved while the reader cooks from a recipe.
      trpc.library.list.infiniteQueryKey({ search: "soup" }),
    ];
    const elsewhere = trpc.pantry.suggestions.queryKey();

    for (const queryKey of [...opened, elsewhere]) {
      // The page reads it while it is open, then the reader leaves.
      const page = new QueryObserver(queryClient, { queryKey, queryFn: async () => ({}) });
      const leave = page.subscribe(() => {});

      await vi.waitFor(() => expect(page.getCurrentResult().isSuccess).toBe(true));
      leave();
    }

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1);

    for (const queryKey of opened) {
      expect(queryClient.getQueryData(queryKey)).toBeDefined();
    }

    // Any other read goes at the default, so the clock really did pass it.
    expect(queryClient.getQueryData(elsewhere)).toBeUndefined();
  });

  it("resets every personalized read artifact while preserving the Outbox and app shell", async () => {
    const clearPersonalCaches = vi.fn(async () => {});

    storage.clearPersonalCaches = clearPersonalCaches;
    await seedOwnerCache(storage, "u1", ["persisted"], "read");
    await writeLastWarmedAt("u1", 123, storage.keyval);
    await storage.outbox.add({
      id: "e",
      ownerId: "u1",
      path: "groceries.create",
      input: {},
      entityId: null,
      operationId: null,
      headers: {},
      createdAt: "2026-07-21T00:00:00.000Z",
      attempts: 0,
      status: "pending",
    });
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    manager.queryClient.setQueryData(["memory"], "read");
    await manager.resetOfflineCopy("manual");

    expect(manager.queryClient.getQueryData(["memory"])).toBeUndefined();
    expect(await storage.keyval.get(queryCacheKey("u1"))).toBeUndefined();
    expect(await readLastWarmedAt("u1", storage.keyval)).toBeNull();
    // The platform's own personal caches (web: images and pages) go with the reads.
    expect(clearPersonalCaches).toHaveBeenCalledTimes(1);
    expect(await storage.outbox.all()).toHaveLength(1);

    manager.queryClient.setQueryData(["rewarmed"], "read");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(manager.owner()).toBe("u1");
    expect(await storage.keyval.get(queryCacheKey("u1"))).toBeDefined();
  });

  it("forgets the cache owner after a sign-out reset", async () => {
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await manager.resetOfflineCopy("sign-out");

    expect(manager.owner()).toBeNull();
    expect(storage.lastOwner.get()).toBeNull();
  });

  it("finalizes sign-out identity even when an artifact cannot be deleted", async () => {
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    vi.spyOn(storage.keyval, "del").mockRejectedValueOnce(new Error("storage unavailable"));
    await manager.resetOfflineCopy("sign-out");

    expect(manager.owner()).toBeNull();
    expect(storage.lastOwner.get()).toBeNull();
  });

  it("resumes manual-reset persistence when an artifact cannot be deleted", async () => {
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    vi.spyOn(storage.keyval, "del").mockRejectedValueOnce(new Error("storage unavailable"));
    await manager.resetOfflineCopy("manual");

    manager.queryClient.setQueryData(["after-reset"], "fresh");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(manager.owner()).toBe("u1");
    expect(await storage.keyval.get(queryCacheKey("u1"))).toBeDefined();
  });

  it("publishes the applied owner as its only identity observable", async () => {
    const manager = createManager();
    const owners: Array<string | null> = [];
    const unsubscribe = manager.subscribe(() => owners.push(manager.owner()));

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await manager.reconcileIdentity({ sessionUserId: "u2", isOffline: false });
    unsubscribe();
    await manager.reconcileIdentity({ sessionUserId: "u3", isOffline: false });

    expect(owners).toEqual(["u1", "u2"]);
  });
});
