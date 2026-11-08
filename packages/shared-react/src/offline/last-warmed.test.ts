import { beforeEach, describe, expect, it } from "vitest";

import type { OfflineStorage } from "./storage";
import { clearLastWarmedAt, readLastWarmedAt, writeLastWarmedAt } from "./last-warmed";
import { createMemoryStorage } from "./testing/memory-storage";

describe("last-warmed timestamp", () => {
  let idb: OfflineStorage["keyval"];

  beforeEach(() => {
    idb = createMemoryStorage().keyval;
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
