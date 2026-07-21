import type { OfflineIdb } from "@/lib/offline/idb";
import { createOfflineIdb } from "@/lib/offline/idb";
import {
  clearLastWarmedAt,
  readLastWarmedAt,
  writeLastWarmedAt,
} from "@/lib/query-cache/last-warmed";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

describe("last-warmed timestamp", () => {
  let idb: OfflineIdb;

  beforeEach(() => {
    idb = createOfflineIdb(new IDBFactory());
  });

  it("returns null before anything is written", async () => {
    expect(await readLastWarmedAt("u1", idb)).toBeNull();
  });

  it("round-trips the timestamp, scoped per owner", async () => {
    await writeLastWarmedAt("u1", 1_700_000_000_000, idb);

    expect(await readLastWarmedAt("u1", idb)).toBe(1_700_000_000_000);
    expect(await readLastWarmedAt("u2", idb)).toBeNull();
  });

  it("clears the timestamp", async () => {
    await writeLastWarmedAt("u1", 123, idb);
    await clearLastWarmedAt("u1", idb);

    expect(await readLastWarmedAt("u1", idb)).toBeNull();
  });
});
