import type { DataTag, QueryKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { createTestQueryClient } from "../platform/testing";
import { readUnderWay } from "./testing";
import { writeOverRead } from "./write-over-read";

const KEY = ["list"] as DataTag<QueryKey, string[]>;

describe("writeOverRead", () => {
  it("keeps a read under way from landing over the write", async () => {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(KEY, ["a"]);
    const land = readUnderWay(queryClient, KEY, ["stale"]);

    writeOverRead(queryClient, KEY, (held) => [...(held ?? []), "b"]);
    await land();

    expect(queryClient.getQueryData(KEY)).toEqual(["a", "b"]);
  });

  it("lets the first read land when nothing is held, rather than leave it loading", async () => {
    const queryClient = createTestQueryClient();
    const land = readUnderWay(queryClient, KEY, ["server"]);

    writeOverRead(queryClient, KEY, (held) => held);
    await land();

    expect(queryClient.getQueryData(KEY)).toEqual(["server"]);
  });
});
