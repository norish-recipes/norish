// @vitest-environment node
import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const warn = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "sec-fetch-dest": "document" }),
}));
vi.mock("@/components/query-seed-boundary", () => ({ QuerySeedBoundary: () => null }));
vi.mock("@norish/shared-server/logger", () => ({ serverLogger: { warn } }));
vi.mock("@norish/trpc/server", () => ({
  appRouter: {},
  createHttpContextFromHeaders: async () => ({}),
}));

const { readQuerySeed } = await import("@/components/query-seed");

const read = (client: QueryClient, name: string, answer: () => unknown) =>
  client.query({ queryKey: [name], queryFn: async () => answer() });

describe("readQuerySeed", () => {
  beforeEach(() => warn.mockClear());

  it("seeds the reads that answered and names the one that failed, with its error", async () => {
    const error = new Error("no database");
    const state = await readQuerySeed((_, client) => [
      read(client, "served", () => "data"),
      read(client, "failed", () => {
        throw error;
      }),
    ]);

    expect(state?.queries.map((query) => query.queryKey)).toEqual([["served"]]);
    expect(warn.mock.calls).toEqual([[{ read: ["failed"], err: error }, "A seeded read failed"]]);
  });

  it("logs a seed that rejects outside its read", async () => {
    const error = new Error("no icons");

    await readQuerySeed(() => [Promise.reject(error)]);

    expect(warn.mock.calls).toEqual([[{ err: error }, "A seed failed"]]);
  });
});
