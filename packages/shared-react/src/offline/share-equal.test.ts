import { describe, expect, it } from "vitest";

import { createOfflineQueryClient } from "./cache-manager";
import { shareEqual } from "./share-equal";

const recipe = (name = "Soup") => ({
  id: "r1",
  name,
  tags: ["quick"],
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  author: undefined,
});

describe("shareEqual", () => {
  it("keeps an unchanged read's objects, Dates included", () => {
    const old = { pages: [{ items: [recipe()] }] };

    expect(shareEqual(old, { pages: [{ items: [recipe()] }] })).toBe(old);
  });

  it("keeps what did not change beside what did", () => {
    const kept = recipe();
    const old = [kept, recipe("Stew")];
    const next = shareEqual(old, [recipe(), recipe("Curry")]) as typeof old;

    expect(next).not.toBe(old);
    expect(next[0]).toBe(kept);
    expect(next[1]?.name).toBe("Curry");
  });

  it("takes a Date that moved, and a key that came or went", () => {
    const old = recipe();
    const later = { ...recipe(), createdAt: new Date("2026-01-03T00:00:00.000Z") };

    expect(shareEqual(old, later)).not.toBe(old);
    expect(shareEqual(old, later)).toMatchObject({ createdAt: later.createdAt, tags: old.tags });
    expect(shareEqual({ a: 1 }, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
    expect(shareEqual({ a: 1, b: 2 }, { a: 1 })).toEqual({ a: 1 });
  });

  it("is what the engine's QueryClient shares a refetch with", async () => {
    const client = createOfflineQueryClient();

    await client.fetchQuery({ queryKey: ["r"], queryFn: () => recipe() });
    const first = client.getQueryData(["r"]);

    await client.fetchQuery({ queryKey: ["r"], queryFn: () => recipe(), staleTime: 0 });

    expect(client.getQueryData(["r"])).toBe(first);
  });
});
