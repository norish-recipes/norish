import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  warmCache,
  warmCalendarRanges,
  warmRecipeListInput,
  type WarmerTRPC,
} from "@/lib/query-cache/cache-warmer";

describe("warmRecipeListInput", () => {
  it("reproduces the dashboard's default (unfiltered) recipe-list input exactly", () => {
    // Must match the canonical default so the warmed infinite-query key equals
    // the grid's. Notably filterMode is "AND" (the real default), not "OR".
    expect(warmRecipeListInput()).toEqual({
      limit: 100,
      search: undefined,
      searchFields: ["title", "ingredients"],
      tags: undefined,
      categories: undefined,
      filterMode: "AND",
      sortMode: "dateDesc",
      minRating: undefined,
      maxCookingTime: undefined,
    });
  });
});

describe("warmCalendarRanges", () => {
  it("warms the desktop week nested inside the wider mobile window", () => {
    const [desktop, mobile] = warmCalendarRanges();

    const iso = /^\d{4}-\d{2}-\d{2}$/;

    expect(desktop.startISO).toMatch(iso);
    expect(desktop.endISO).toMatch(iso);
    expect(mobile.startISO).toMatch(iso);
    expect(mobile.endISO).toMatch(iso);

    // ISO date strings sort lexicographically, so string comparison is valid.
    expect(desktop.startISO >= mobile.startISO).toBe(true);
    expect(desktop.endISO <= mobile.endISO).toBe(true);
  });
});

describe("warmCache", () => {
  function makeTrpc() {
    const getCalls: string[] = [];
    const listQueryFn = vi.fn(async () => ({
      recipes: [{ id: "r1" }, { id: "r2" }, { id: "r3" }],
      total: 3,
      nextCursor: null as number | null,
    }));

    const trpc: WarmerTRPC = {
      recipes: {
        list: {
          infiniteQueryOptions: (input, opts) => ({
            queryKey: ["recipes", "list", input],
            queryFn: listQueryFn,
            initialPageParam: 0,
            getNextPageParam: opts.getNextPageParam,
          }),
        },
        get: {
          queryOptions: ({ id }) => ({
            queryKey: ["recipes", "get", id],
            queryFn: async () => {
              getCalls.push(id);

              return { id };
            },
          }),
        },
      },
      groceries: {
        list: { queryOptions: () => ({ queryKey: ["groceries", "list"], queryFn: async () => ({}) }) },
      },
      stores: {
        list: { queryOptions: () => ({ queryKey: ["stores", "list"], queryFn: async () => [] }) },
      },
      calendar: {
        listItems: {
          queryOptions: (range) => ({
            queryKey: ["calendar", range.startISO, range.endISO],
            queryFn: async () => [],
          }),
        },
      },
    };

    return { trpc, getCalls };
  }

  it("warms the recipe list, each recipe in full, and all lists + calendar ranges", async () => {
    const queryClient = new QueryClient();
    const { trpc, getCalls } = makeTrpc();

    await warmCache({ trpc, queryClient });

    // Recipe list landed under the exact key the dashboard reads.
    const list = queryClient.getQueryData(["recipes", "list", warmRecipeListInput()]);

    expect(list).toBeDefined();

    // Every recipe from the list was warmed in full.
    expect(getCalls).toEqual(["r1", "r2", "r3"]);
    expect(queryClient.getQueryData(["recipes", "get", "r2"])).toEqual({ id: "r2" });

    // Groceries, stores and both calendar windows are warmed.
    expect(queryClient.getQueryData(["groceries", "list"])).toBeDefined();
    expect(queryClient.getQueryData(["stores", "list"])).toBeDefined();

    for (const range of warmCalendarRanges()) {
      expect(queryClient.getQueryData(["calendar", range.startISO, range.endISO])).toBeDefined();
    }
  });

  it("does not reject when a single prefetch fails", async () => {
    const queryClient = new QueryClient();
    const { trpc } = makeTrpc();

    trpc.stores.list.queryOptions = () => ({
      queryKey: ["stores", "list"],
      queryFn: async () => {
        throw new Error("backend down mid-warm");
      },
    });

    await expect(warmCache({ trpc, queryClient })).resolves.toBeUndefined();
    // The rest still warmed despite the failure.
    expect(queryClient.getQueryData(["groceries", "list"])).toBeDefined();
  });
});
