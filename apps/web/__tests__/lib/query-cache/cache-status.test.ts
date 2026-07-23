import { createOfflineIdb, KEYVAL_STORE, OUTBOX_STORE } from "@/lib/offline/idb";
import { queryCacheKey } from "@/lib/query-cache/cache-identity";
import { wipeReadCache } from "@/lib/query-cache/cache-status";
import { readLastWarmedAt, writeLastWarmedAt } from "@/lib/query-cache/last-warmed";
import { QueryClient } from "@tanstack/react-query";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

const trpc = {
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
} as const;

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
