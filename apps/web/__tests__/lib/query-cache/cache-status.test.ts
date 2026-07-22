import type { CacheStatusTRPC } from "@/lib/query-cache/cache-status";
import { createOfflineIdb, KEYVAL_STORE, OUTBOX_STORE } from "@/lib/offline/idb";
import { queryCacheKey } from "@/lib/query-cache/cache-identity";
import { getOfflineCacheCounts, wipeReadCache } from "@/lib/query-cache/cache-status";
import { warmCalendarRanges } from "@/lib/query-cache/cache-warmer";
import { readLastWarmedAt, writeLastWarmedAt } from "@/lib/query-cache/last-warmed";
import { QueryClient } from "@tanstack/react-query";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

const trpc: CacheStatusTRPC = {
  recipes: {
    get: { queryKey: ({ id }) => [["recipes", "get"], { input: { id }, type: "query" }] },
  },
  groceries: { list: { queryKey: () => [["groceries", "list"], { type: "query" }] } },
  stores: { list: { queryKey: () => [["stores", "list"], { type: "query" }] } },
  calendar: {
    listItems: {
      queryKey: ({ startISO, endISO }) => [
        ["calendar", "listItems"],
        { input: { startISO, endISO }, type: "query" },
      ],
    },
  },
};

describe("getOfflineCacheCounts", () => {
  it("counts each category from what is actually cached", () => {
    const queryClient = new QueryClient();

    queryClient.setQueryData(trpc.recipes.get.queryKey({ id: "r1" }), { id: "r1" });
    queryClient.setQueryData(trpc.recipes.get.queryKey({ id: "r2" }), { id: "r2" });
    queryClient.setQueryData(trpc.groceries.list.queryKey(), {
      groceries: [{}, {}, {}],
      recurringGroceries: [],
    });
    queryClient.setQueryData(trpc.stores.list.queryKey(), [{}, {}]);
    queryClient.setQueryData(trpc.calendar.listItems.queryKey(warmCalendarRanges()[0]), [
      {},
      {},
      {},
    ]);

    expect(getOfflineCacheCounts(queryClient, trpc)).toEqual({
      recipes: 2,
      groceries: 3,
      stores: 2,
      plannedThisWeek: 3,
    });
  });

  it("reports zeros for an empty cache", () => {
    expect(getOfflineCacheCounts(new QueryClient(), trpc)).toEqual({
      recipes: 0,
      groceries: 0,
      stores: 0,
      plannedThisWeek: 0,
    });
  });
});

describe("wipeReadCache", () => {
  it("clears the read cache and last-warmed stamp but never the Outbox", async () => {
    const idb = createOfflineIdb(new IDBFactory());
    const queryClient = new QueryClient();

    queryClient.setQueryData(trpc.recipes.get.queryKey({ id: "r1" }), { id: "r1" });
    await idb.set(KEYVAL_STORE, queryCacheKey("u1"), { dehydrated: "blob" });
    await writeLastWarmedAt("u1", 123, idb);
    // A queued mutation sits in the separate Outbox store — it must survive.
    await idb.transaction(OUTBOX_STORE, "readwrite", (store) =>
      store.add({ path: "groceries.create" })
    );

    await wipeReadCache(queryClient, { ownerId: "u1", idb });

    expect(queryClient.getQueryData(trpc.recipes.get.queryKey({ id: "r1" }))).toBeUndefined();
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u1"))).toBeUndefined();
    expect(await readLastWarmedAt("u1", idb)).toBeNull();

    const outboxCount = await idb.transaction(OUTBOX_STORE, "readonly", (store) => store.count());
    expect(outboxCount).toBe(1);
  });
});
