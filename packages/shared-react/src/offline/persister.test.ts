import { dehydrate, QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OfflineStorage } from "./storage";
import { queryCacheKey, queryCachePrefix } from "./cache-identity";
import { createQueryStore } from "./persister";
import { createMemoryStorage } from "./testing/memory-storage";

const MAX_AGE = 1000;

function read(key: string, value: unknown) {
  const client = new QueryClient();

  client.setQueryData([key], value);

  return dehydrate(client).queries[0]!;
}

describe("createQueryStore", () => {
  let keyval: OfflineStorage["keyval"];
  const restore = (owner: string, buster = "v1") =>
    createQueryStore(keyval).restore(owner, { buster, maxAge: MAX_AGE });

  beforeEach(() => {
    keyval = createMemoryStorage().keyval;
  });
  afterEach(() => vi.useRealTimers());

  it("keeps each read under its owner's key, apart from another owner's", async () => {
    const store = createQueryStore(keyval);

    await store.write("a", read("greeting", "for a"), "v1");
    await store.write("ab", read("greeting", "for ab"), "v1");

    expect((await restore("a")).map((query) => query.state.data)).toEqual(["for a"]);
    expect(await keyval.get(queryCacheKey("a", read("greeting", "").queryHash))).toBeDefined();
  });

  it("drops reads another app version saved", async () => {
    await createQueryStore(keyval).write("a", read("greeting", "old app"), "v0");

    expect(await restore("a")).toEqual([]);
    expect(await keyval.entries(queryCachePrefix("a"))).toEqual([]);
  });

  it("removes one read, and clears every read of an owner's", async () => {
    const store = createQueryStore(keyval);
    const kept = read("kept", 1);

    await store.write("a", read("gone", 1), "v1");
    await store.write("a", kept, "v1");
    await store.write("b", read("other", 1), "v1");
    await store.remove("a", read("gone", 1).queryHash);

    expect((await restore("a")).map((query) => query.queryKey)).toEqual([["kept"]]);

    await store.clear("a");

    expect(await restore("a")).toEqual([]);
    expect(await restore("b")).toHaveLength(1);
  });

  it("deletes an owner's entry it cannot read as a saved read", async () => {
    await keyval.set(queryCachePrefix("a"), { clientState: { queries: [] } });

    expect(await restore("a")).toEqual([]);
    expect(await keyval.keys()).toEqual([]);
  });
});
