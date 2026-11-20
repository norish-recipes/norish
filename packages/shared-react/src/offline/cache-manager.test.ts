import { dehydrate, hydrate, QueryClient, QueryObserver } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";

import type { OfflineStorage } from "./storage";
import { queryCachePrefix } from "./cache-identity";
import {
  CACHE_MAX_AGE_MS,
  createCacheManager,
  OWNER_WRITE_WAIT_MS,
  PERSIST_THROTTLE_MS,
} from "./cache-manager";
import { readLastWarmedAt, writeLastWarmedAt } from "./last-warmed";
import { createQueryStore } from "./persister";
import { createMemoryStorage } from "./testing/memory-storage";

const CACHE_BUSTER = "0.0.0-test";

/** A save's longest wait: the throttle, then the idle callback's deadline. */
const SAVED_MS = 2 * PERSIST_THROTTLE_MS;

/** Fake timers that also hold the idle callback a save waits for. */
const useFakeTimers = () =>
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
      "requestIdleCallback",
      "cancelIdleCallback",
    ],
  });

/** Save one successful read for `owner`, as an earlier session would have. */
async function seedOwnerCache(
  storage: OfflineStorage,
  owner: string,
  key: unknown[],
  value: unknown
): Promise<void> {
  const source = new QueryClient();

  source.setQueryData(key, value);
  const [query] = dehydrate(source).queries;

  if (query) await createQueryStore(storage.keyval).write(owner, query, CACHE_BUSTER);
}

/** The reads saved for `owner`. */
async function persisted(storage: OfflineStorage, owner: string) {
  const entries = await storage.keyval.entries<{ query?: { queryKey: unknown[] } }>(
    `${queryCachePrefix(owner)}:`
  );

  // Past the marker of when the copy was last in use.
  return entries.flatMap(([, stored]) => (stored.query ? [stored.query] : []));
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
    expect(await persisted(storage, "u1")).toEqual([]);
    expect(await readLastWarmedAt("u1", storage.keyval)).toBeNull();
    // The new owner is recorded as the cache owner.
    expect(storage.lastOwner.get()).toBe("u2");
  });

  it("adopts a first owner without a purge and starts persisting under their key", async () => {
    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    manager.queryClient.setQueryData(["k"], "v");

    await manager.flush();

    expect(manager.owner()).toBe("u1");
    expect(await persisted(storage, "u1")).toHaveLength(1);
  });

  it("saves a burst of changes inside one interval at its end, each read once", async () => {
    useFakeTimers();
    const manager = createManager();
    const set = vi.spyOn(storage.keyval, "set");

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    for (let index = 0; index < 50; index += 1) {
      manager.queryClient.setQueryData(["recipe", index], index);
    }
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS - 1);

    expect(set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SAVED_MS);

    expect(set).toHaveBeenCalledTimes(50);
    expect(await persisted(storage, "u1")).toHaveLength(50);
  });

  it("writes only the reads that changed, and deletes one that left the cache", async () => {
    useFakeTimers();
    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    manager.queryClient.setQueryData(["a"], 1);
    manager.queryClient.setQueryData(["b"], 1);
    await vi.advanceTimersByTimeAsync(SAVED_MS);

    const set = vi.spyOn(storage.keyval, "set");

    manager.queryClient.setQueryData(["a"], 2);
    manager.queryClient.removeQueries({ queryKey: ["b"] });
    await vi.advanceTimersByTimeAsync(SAVED_MS);

    expect(set).toHaveBeenCalledTimes(1);
    expect(await persisted(storage, "u1")).toMatchObject([{ queryKey: ["a"], state: { data: 2 } }]);
  });

  it("restores every read while the newest save is within maxAge, none once it is older", async () => {
    useFakeTimers();
    await seedOwnerCache(storage, "u1", ["old"], "kept with the cache");
    vi.advanceTimersByTime(CACHE_MAX_AGE_MS - 1);
    await seedOwnerCache(storage, "u1", ["new"], "fresh");

    const inUse = createManager();

    await inUse.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    expect(inUse.queryClient.getQueryData(["old"])).toBe("kept with the cache");

    vi.advanceTimersByTime(CACHE_MAX_AGE_MS + 1);
    const unused = createManager();

    await unused.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    expect(unused.queryClient.getQueryData(["new"])).toBeUndefined();
    expect(await persisted(storage, "u1")).toEqual([]);
  });

  it("keeps a copy opened within maxAge of each use, though no read got new data", async () => {
    useFakeTimers();
    await seedOwnerCache(storage, "u1", ["k"], "from a week ago");

    for (const _ of [1, 2]) {
      vi.advanceTimersByTime(CACHE_MAX_AGE_MS - 1);
      const opened = createManager();

      await opened.reconcileIdentity({ sessionUserId: "u1", isOffline: true });
      expect(opened.queryClient.getQueryData(["k"])).toBe("from a week ago");
    }
  });

  it("saves the reads made before a first owner was known, and a read hydrated in later", async () => {
    useFakeTimers();
    const manager = createManager();

    manager.queryClient.setQueryData(["early"], "read before the session was confirmed");
    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await vi.advanceTimersByTimeAsync(SAVED_MS);
    expect((await persisted(storage, "u1")).map((query) => query.queryKey)).toEqual([["early"]]);

    const server = new QueryClient();

    server.setQueryData(["seeded"], "the server's first frame");
    hydrate(manager.queryClient, dehydrate(server));
    await vi.advanceTimersByTimeAsync(SAVED_MS);
    expect((await persisted(storage, "u1")).map((query) => query.queryKey)).toContainEqual([
      "seeded",
    ]);
  });

  it("saves no copy for a fetch starting or a read going stale, only for new data", async () => {
    useFakeTimers();
    const manager = createManager();
    const set = vi.spyOn(storage.keyval, "set");

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    manager.queryClient.setQueryData(["k"], "v");
    await vi.advanceTimersByTimeAsync(SAVED_MS);
    expect(set).toHaveBeenCalledTimes(1);

    let answer!: (value: string) => void;
    const fetching = manager.queryClient.fetchQuery({
      queryKey: ["k"],
      staleTime: 0,
      queryFn: () => new Promise<string>((resolve) => (answer = resolve)),
    });

    await manager.queryClient.invalidateQueries({ queryKey: ["k"], refetchType: "none" });
    await vi.advanceTimersByTimeAsync(SAVED_MS);
    expect(set).toHaveBeenCalledTimes(1);

    answer("w");
    await fetching;
    await vi.advanceTimersByTimeAsync(SAVED_MS);
    expect(set).toHaveBeenCalledTimes(2);
  });

  it("saves a pending change at once on a flush, and not again when the interval ends", async () => {
    useFakeTimers();
    const manager = createManager();
    const set = vi.spyOn(storage.keyval, "set");

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    manager.queryClient.setQueryData(["k"], "v");
    await manager.flush();

    // A flush also marks the copy as in use.
    const reads = () => set.mock.calls.filter(([key]) => !key.endsWith(":used")).length;

    expect(reads()).toBe(1);
    await vi.advanceTimersByTimeAsync(SAVED_MS);

    expect(reads()).toBe(1);
  });

  it("never writes a pending save back after the read copy is reset", async () => {
    useFakeTimers();
    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    manager.queryClient.setQueryData(["k"], "v");
    await manager.resetOfflineCopy("sign-out");
    await vi.advanceTimersByTimeAsync(SAVED_MS);

    expect(await persisted(storage, "u1")).toEqual([]);
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

    await manager.flush();

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
    await manager.flush();

    expect(waiting.state.isPaused).toBe(true);
    // Only reads are stored; the waiting mutation is not among them.
    expect((await persisted(storage, "u1")).map((query) => query.queryKey)).toEqual([["k"]]);
    first.resolve();
  });

  it("never persists the stored CalDAV password or the live connection check", async () => {
    const manager = createManager();
    const trpc = createTRPCOptionsProxy<AppRouter>({
      client: createTRPCClient<AppRouter>({ links: [] }),
      queryClient: manager.queryClient,
    });
    const kept = trpc.caldav.getConfig.queryKey();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    manager.queryClient.setQueryData(trpc.caldav.getPassword.queryKey(), "secret");
    manager.queryClient.setQueryData(trpc.caldav.checkConnection.queryKey(), {
      success: true,
      message: "checked",
    });
    manager.queryClient.setQueryData(kept, null);
    await manager.flush();

    const stored = await persisted(storage, "u1");

    expect(stored.map((query) => query.queryKey)).toContainEqual(kept);
    expect(JSON.stringify(stored)).not.toContain("secret");
    expect(JSON.stringify(stored)).not.toContain("checked");
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
    await manager.flush();

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
    useFakeTimers();

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

  it("keeps a primed Ingredient name for the whole session, past the cache's maxAge", async () => {
    useFakeTimers();

    const { queryClient } = createManager();
    const trpc = createTRPCOptionsProxy<AppRouter>({
      client: createTRPCClient<AppRouter>({ links: [] }),
      queryClient,
    });
    const primed = trpc.ingredients.names.queryKey({ ids: ["i1"] });

    queryClient.setQueryData(primed, { i1: "onion" });
    await vi.advanceTimersByTimeAsync(CACHE_MAX_AGE_MS + 1);

    expect(queryClient.getQueryData(primed)).toEqual({ i1: "onion" });
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
    expect(await persisted(storage, "u1")).toEqual([]);
    expect(await readLastWarmedAt("u1", storage.keyval)).toBeNull();
    // The platform's own personal caches (web: images and pages) go with the reads.
    expect(clearPersonalCaches).toHaveBeenCalledTimes(1);
    expect(await storage.outbox.all()).toHaveLength(1);

    manager.queryClient.setQueryData(["rewarmed"], "read");
    await manager.flush();

    expect(manager.owner()).toBe("u1");
    expect((await persisted(storage, "u1")).map((query) => query.queryKey)).toEqual([["rewarmed"]]);
  });

  it("keeps an owner's named data until a sign-out or an account switch drops it", async () => {
    storage.lastOwner.set("u1");
    await storage.keyval.set("owner-data:u2:recent", ["theirs"]);

    const manager = createManager();

    expect(manager.ownerData.owner()).toBeNull();
    expect(await manager.ownerData.read("u1", "recent")).toBeUndefined();
    await manager.ownerData.write("u1", "recent", ["ignored"]);
    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await manager.ownerData.write("u1", "recent", ["soup"]);
    await manager.ownerData.write("u2", "recent", ["not open"]);

    expect(await manager.ownerData.read("u1", "recent")).toEqual(["soup"]);
    expect(await manager.ownerData.read("u2", "recent")).toBeUndefined();
    expect(await storage.keyval.get("owner-data:u1:recent")).toEqual(["soup"]);

    await manager.resetOfflineCopy("sign-out");

    expect(await storage.keyval.get("owner-data:u1:recent")).toBeUndefined();
    expect(manager.ownerData.owner()).toBeNull();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await manager.ownerData.write("u1", "recent", ["soup"]);
    await manager.reconcileIdentity({ sessionUserId: "u3", isOffline: false });

    expect(await storage.keyval.get("owner-data:u1:recent")).toBeUndefined();
    expect(await storage.keyval.get("owner-data:u2:recent")).toBeUndefined();
    expect(await manager.ownerData.read("u3", "recent")).toBeUndefined();
  });

  it("closes the owner's data while a wipe or switch clears it, and tells its readers", async () => {
    storage.lastOwner.set("u1");

    const manager = createManager();
    const open: Array<string | null> = [];

    manager.ownerData.subscribe(() => open.push(manager.ownerData.owner()));
    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await manager.ownerData.write("u1", "recent", ["soup"]);
    await manager.resetOfflineCopy("manual");

    expect(await storage.keyval.get("owner-data:u1:recent")).toBeUndefined();

    await manager.reconcileIdentity({ sessionUserId: "u2", isOffline: false });
    await manager.resetOfflineCopy("sign-out");

    expect(open).toEqual(["u1", null, "u1", null, "u2", null]);
  });

  it("says, while closed, which owner the data reopens for: the same after a wipe", async () => {
    storage.lastOwner.set("u1");

    const manager = createManager();
    const told: Array<[string | null, string | null]> = [];

    manager.ownerData.subscribe(() =>
      told.push([manager.ownerData.owner(), manager.ownerData.next()])
    );
    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await manager.resetOfflineCopy("manual");
    await manager.reconcileIdentity({ sessionUserId: "u2", isOffline: false });
    await manager.resetOfflineCopy("sign-out");

    expect(told).toEqual([
      ["u1", "u1"],
      [null, "u1"],
      ["u1", "u1"],
      [null, "u2"],
      ["u2", "u2"],
      [null, null],
    ]);
  });

  it("writes nothing under the departing owner once a switch starts clearing it", async () => {
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });

    const listKeys = storage.keyval.keys.bind(storage.keyval);

    // A confirm lands while the purge lists the departing owner's keys.
    vi.spyOn(storage.keyval, "keys").mockImplementation(async () => {
      const keys = await listKeys();

      await manager.ownerData.write("u1", "recent", ["late"]);

      return keys;
    });
    await manager.reconcileIdentity({ sessionUserId: "u2", isOffline: false });

    expect(await storage.keyval.get("owner-data:u1:recent")).toBeUndefined();
  });

  it("clears a write still landing when the switch starts", async () => {
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });

    const setValue = storage.keyval.set.bind(storage.keyval);

    vi.spyOn(storage.keyval, "set").mockImplementationOnce(async (key, value) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await setValue(key, value);
    });
    const landed = manager.ownerData.write("u1", "recent", ["slow"]);

    await manager.reconcileIdentity({ sessionUserId: "u2", isOffline: false });
    await landed;

    expect(await storage.keyval.get("owner-data:u1:recent")).toBeUndefined();
  });

  /** Holds every owner-data write until `land()`; a held write stores its value as it lands. */
  function holdOwnerDataWrites() {
    const setValue = storage.keyval.set.bind(storage.keyval);
    const held: Array<() => Promise<void>> = [];
    const values: unknown[] = [];

    vi.spyOn(storage.keyval, "set").mockImplementation((key, value) => {
      if (!key.startsWith("owner-data:")) return setValue(key, value);

      values.push(value);

      return new Promise<void>((resolve) => {
        held.push(() => setValue(key, value).then(resolve));
      });
    });

    return {
      held,
      values,
      land: async (index = 0) => {
        await held[index]?.();
        await vi.advanceTimersByTimeAsync(0);
      },
    };
  }

  it("ends a session and switches owner though an owner-data write never settles", async () => {
    useFakeTimers();
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    holdOwnerDataWrites();
    void manager.ownerData.write("u1", "recent", ["stuck"]);

    let switched = false;

    void manager.reconcileIdentity({ sessionUserId: "u2", isOffline: false }).then(() => {
      switched = true;
    });
    await vi.advanceTimersByTimeAsync(OWNER_WRITE_WAIT_MS);

    expect(switched).toBe(true);
    expect(manager.owner()).toBe("u2");

    void manager.ownerData.write("u2", "recent", ["stuck too"]);

    let signedOut = false;

    void manager.resetOfflineCopy("sign-out").then(() => {
      signedOut = true;
    });
    await vi.advanceTimersByTimeAsync(OWNER_WRITE_WAIT_MS);

    expect(signedOut).toBe(true);
    expect(manager.owner()).toBeNull();
  });

  it("leaves no key behind for a write that lands after its owner's data was cleared", async () => {
    useFakeTimers();
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });

    const writes = holdOwnerDataWrites();

    void manager.ownerData.write("u1", "recent", ["late"]);

    const signedOut = manager.resetOfflineCopy("sign-out");

    await vi.advanceTimersByTimeAsync(OWNER_WRITE_WAIT_MS);
    await signedOut;
    await writes.land();

    expect(await storage.keyval.keys()).not.toContain("owner-data:u1:recent");
  });

  it("closes the departing owner's data the moment a switch or sign-out is asked for", async () => {
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });

    // Queued behind another resolution, so the switch has not started when the confirm lands.
    const resolving = manager.reconcileIdentity({ sessionUserId: "u1", isOffline: true });
    const switching = manager.reconcileIdentity({ sessionUserId: "u2", isOffline: false });

    expect(manager.ownerData.owner()).toBeNull();
    await manager.ownerData.write("u1", "recent", ["mid-switch"]);
    await Promise.all([resolving, switching]);

    expect(await storage.keyval.get("owner-data:u1:recent")).toBeUndefined();
    expect(manager.ownerData.owner()).toBe("u2");

    const signingOut = manager.resetOfflineCopy("sign-out");

    expect(manager.ownerData.owner()).toBeNull();
    await manager.ownerData.write("u2", "recent", ["mid-sign-out"]);
    await signingOut;

    expect(await storage.keyval.get("owner-data:u2:recent")).toBeUndefined();
  });

  it("writes one owner's value in the order it changed, only the newest still waiting", async () => {
    useFakeTimers();
    storage.lastOwner.set("u1");

    const manager = createManager();

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });

    const writes = holdOwnerDataWrites();

    void manager.ownerData.write("u1", "recent", ["first"]);
    await vi.advanceTimersByTimeAsync(0);
    void manager.ownerData.write("u1", "recent", ["second"]);
    void manager.ownerData.write("u1", "recent", ["third"]);
    await vi.advanceTimersByTimeAsync(0);
    // The newest write is let land first, as an adapter that does not order them would.
    await writes.land(writes.held.length - 1);
    for (let index = 0; index < writes.held.length; index++) await writes.land(index);

    expect(await storage.keyval.get("owner-data:u1:recent")).toEqual(["third"]);
    expect(writes.values).toEqual([["first"], ["third"]]);
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
    await manager.flush();

    expect(manager.owner()).toBe("u1");
    expect((await persisted(storage, "u1")).map((query) => query.queryKey)).toContainEqual([
      "after-reset",
    ]);
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
