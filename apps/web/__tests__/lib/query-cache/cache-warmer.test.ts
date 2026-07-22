import type { WarmerTRPC } from "@/lib/query-cache/cache-warmer";
import { IMAGE_CACHE_NAME } from "@/lib/offline/cache-names";
import {
  topUpWarmSet,
  warmCache,
  warmCalendarRanges,
  warmRecipeListInput,
} from "@/lib/query-cache/cache-warmer";
import { writeLastWarmedAt } from "@/lib/query-cache/last-warmed";
import { activeCacheOwner } from "@/lib/query-cache/persisted-query-client";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/query-cache/last-warmed", () => ({
  writeLastWarmedAt: vi.fn(async () => {}),
}));

vi.mock("@/lib/query-cache/persisted-query-client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  activeCacheOwner: vi.fn(() => "owner-1"),
}));

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
      list: {
        queryOptions: () => ({ queryKey: ["groceries", "list"], queryFn: async () => ({}) }),
      },
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

describe("warmCache", () => {
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

describe("warmCache primary images (ADR-0009)", () => {
  function makeImageEnv() {
    const putUrls: string[] = [];
    const cached = new Set<string>();
    const cache = {
      match: vi.fn(async (url: string) => (cached.has(url) ? new Response("hit") : undefined)),
      put: vi.fn(async (url: string, _response: Response) => {
        putUrls.push(url);
      }),
    };
    const open = vi.fn(async (name: string) => {
      expect(name).toBe(IMAGE_CACHE_NAME);

      return cache;
    });

    vi.stubGlobal("caches", { open });

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("broken")) throw new TypeError("Failed to fetch");
      if (url.includes("missing")) return new Response("nope", { status: 404 });

      return new Response("img", { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    return { putUrls, cached, fetchMock };
  }

  function trpcWithImages(recipes: Array<{ id: string; image?: string | null }>) {
    const { trpc } = makeTrpc();

    trpc.recipes.list.infiniteQueryOptions = (input, opts) => ({
      queryKey: ["recipes", "list", input],
      queryFn: async () => ({ recipes, total: recipes.length, nextCursor: null }),
      initialPageParam: 0,
      getNextPageParam: opts.getNextPageParam,
    });

    return trpc;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches each warmed recipe's primary image into the bounded image cache", async () => {
    const { putUrls, fetchMock } = makeImageEnv();
    const trpc = trpcWithImages([
      { id: "r1", image: "/uploads/r1.jpg" },
      { id: "r2", image: null },
      { id: "r3", image: "/uploads/r3.jpg" },
    ]);

    await warmCache({ trpc, queryClient: new QueryClient() });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(putUrls.map((url) => new URL(url).pathname)).toEqual([
      "/uploads/r1.jpg",
      "/uploads/r3.jpg",
    ]);
  });

  it("isolates media failures and skips already-cached and cross-origin images", async () => {
    const { putUrls, cached } = makeImageEnv();

    cached.add(new URL("/uploads/warm.jpg", window.location.href).toString());

    const trpc = trpcWithImages([
      { id: "r1", image: "/uploads/broken.jpg" },
      { id: "r2", image: "/uploads/missing.jpg" },
      { id: "r3", image: "https://elsewhere.example/x.jpg" },
      { id: "r4", image: "/uploads/warm.jpg" },
      { id: "r5", image: "/uploads/ok.jpg" },
    ]);

    await expect(warmCache({ trpc, queryClient: new QueryClient() })).resolves.toBeUndefined();

    // Only the fetchable, uncached, same-origin image lands in the cache.
    expect(putUrls.map((url) => new URL(url).pathname)).toEqual(["/uploads/ok.jpg"]);
  });

  it("warms no images when Cache Storage is unavailable", async () => {
    const trpc = trpcWithImages([{ id: "r1", image: "/uploads/r1.jpg" }]);

    // No `caches` global stubbed — the warm must still complete.
    await expect(warmCache({ trpc, queryClient: new QueryClient() })).resolves.toBeUndefined();
  });
});

describe("topUpWarmSet", () => {
  // The Warmer's structural surface, warming nothing: enough to exercise the
  // warm-then-stamp composition without the full fixture above.
  function makeEmptyTrpc(): WarmerTRPC {
    return {
      recipes: {
        list: {
          infiniteQueryOptions: (input, opts) => ({
            queryKey: ["recipes", "list", input],
            queryFn: async () => ({ recipes: [], total: 0, nextCursor: null }),
            initialPageParam: 0,
            getNextPageParam: opts.getNextPageParam,
          }),
        },
        get: {
          queryOptions: ({ id }) => ({
            queryKey: ["recipes", "get", id],
            queryFn: async () => ({ id }),
          }),
        },
      },
      groceries: {
        list: {
          queryOptions: () => ({ queryKey: ["groceries", "list"], queryFn: async () => ({}) }),
        },
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
  }

  beforeEach(() => {
    vi.mocked(writeLastWarmedAt).mockClear();
    vi.mocked(activeCacheOwner).mockReturnValue("owner-1");
  });

  it("warms and then stamps last-warmed for the active owner", async () => {
    const queryClient = new QueryClient();

    await topUpWarmSet({ trpc: makeEmptyTrpc(), queryClient });

    // The warm ran (list landed under the dashboard key)…
    expect(queryClient.getQueryData(["recipes", "list", warmRecipeListInput()])).toBeDefined();
    // …and the stamp followed it.
    expect(writeLastWarmedAt).toHaveBeenCalledWith("owner-1", expect.any(Number));
  });

  it("skips the stamp when no cache owner is active", async () => {
    vi.mocked(activeCacheOwner).mockReturnValue(null);

    await topUpWarmSet({ trpc: makeEmptyTrpc(), queryClient: new QueryClient() });

    expect(writeLastWarmedAt).not.toHaveBeenCalled();
  });
});
