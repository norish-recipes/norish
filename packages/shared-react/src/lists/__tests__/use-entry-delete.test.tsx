import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContentEntry } from "../content-view";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "../../platform/testing";
import { resetTRPCFake, serveTRPC, trpcCalls } from "../../trpc/testing";
import { useEntryDelete } from "../use-entry-delete";

const usage = vi.hoisted(() => vi.fn());

vi.mock("../../trpc", async () => ({
  ...(await import("../../trpc/testing")).mockTRPC(),
  useTRPCClient: () => ({ lists: { usage: { query: usage } } }),
}));

const entry = (over: Partial<ContentEntry> = {}) =>
  ({
    id: "1",
    name: "Diner",
    instance: false,
    version: 1,
    recipeCount: 97,
    editable: true,
    ...over,
  }) as ContentEntry;
const wrapper = () => createTestWrapper(createTestQueryClient(), fakePlatformAdapter());

afterEach(() => {
  resetTRPCFake();
  usage.mockReset();
});

describe("useEntryDelete", () => {
  it("counts a household entry from the list, and a server entry from the server", async () => {
    usage.mockResolvedValue({ recipeCount: 181 });

    const { result } = renderHook(() => useEntryDelete("cuisine"), { wrapper: wrapper() });

    expect(await result.current.impact(entry())).toEqual({ recipes: 97, scope: "household" });
    expect(await result.current.impact(entry({ instance: true }))).toEqual({
      recipes: 181,
      scope: "server",
    });
    expect(usage).toHaveBeenCalledWith({ kind: "cuisine", id: "1" });
  });

  it("has no count when the server's read fails", async () => {
    usage.mockRejectedValue(new Error("down"));

    const { result } = renderHook(() => useEntryDelete("cuisine"), { wrapper: wrapper() });

    expect(await result.current.impact(entry({ instance: true }))).toBeNull();
  });

  it("says whether the delete went through, was stale, or failed", async () => {
    const answers = [{ stale: true }, { stale: false, detached: 1 }];

    serveTRPC(async (path) => (path === "lists.delete" ? answers.shift() : {}));

    const { result } = renderHook(() => useEntryDelete("tag"), { wrapper: wrapper() });

    expect(await result.current.remove(entry())).toBe("stale");
    expect(await result.current.remove(entry())).toBe("deleted");
    serveTRPC(async () => {
      throw new Error("down");
    });
    expect(await result.current.remove(entry())).toBe("failed");
    expect(trpcCalls["lists.delete"]).toBeUndefined();
  });
});
