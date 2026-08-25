import { readLastWarmedAt, writeLastWarmedAt } from "@/lib/query-cache/last-warmed";
import { cacheManager } from "@/lib/query-cache/persisted-query-client";
import { createWarmSet } from "@/lib/query-cache/warm-set";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const expirationMetadata = vi.hoisted(() => ({
  updateTimestamp: vi.fn(async () => {}),
  expireEntries: vi.fn(async () => {}),
}));

vi.mock("serwist", () => ({
  CacheExpiration: class {
    updateTimestamp(url: string) {
      return expirationMetadata.updateTimestamp(url);
    }

    expireEntries() {
      return expirationMetadata.expireEntries();
    }
  },
}));

vi.mock("@/lib/query-cache/last-warmed", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readLastWarmedAt: vi.fn(async () => 123),
  writeLastWarmedAt: vi.fn(async () => {}),
}));

vi.mock("@/lib/query-cache/persisted-query-client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cacheManager: { owner: vi.fn(() => "owner-1") },
}));

function makeTrpc() {
  return {
    // The Library is what the Warm Set warms: one interleaved list holding
    // both kinds (ADR-0026).
    library: {
      list: {
        infiniteQueryOptions: (input: unknown, options: object) => ({
          queryKey: [["library", "list"], { input, type: "infinite" }],
          queryFn: async () => ({
            items: [
              { kind: "recipe", recipe: { id: "r1" } },
              { kind: "recipe", recipe: { id: "r2" } },
              { kind: "cookbook", cookbook: { id: "c1" } },
            ],
            total: 3,
            nextCursor: null,
          }),
          initialPageParam: 0,
          ...options,
        }),
      },
    },
    cookbooks: {
      get: {
        queryOptions: ({ id }: { id: string }) => ({
          queryKey: [["cookbooks", "get"], { input: { id }, type: "query" }],
          queryFn: async () => ({ id, title: `Cookbook ${id}` }),
        }),
        queryKey: ({ id }: { id: string }) => [
          ["cookbooks", "get"],
          { input: { id }, type: "query" },
        ],
      },
      recipes: {
        infiniteQueryOptions: (input: { cookbookId: string }, options: object) => ({
          queryKey: [["cookbooks", "recipes"], { input, type: "infinite" }],
          queryFn: async () => ({ recipes: [{ id: "r1" }], total: 1, nextCursor: null }),
          initialPageParam: 0,
          ...options,
        }),
      },
      editable: {
        queryOptions: () => ({
          queryKey: [["cookbooks", "editable"], { type: "query" }],
          queryFn: async () => [{ id: "c1", title: "Cookbook c1" }],
        }),
        queryKey: () => [["cookbooks", "editable"], { type: "query" }],
      },
      forRecipe: {
        queryOptions: ({ recipeId }: { recipeId: string }) => ({
          queryKey: [["cookbooks", "forRecipe"], { input: { recipeId }, type: "query" }],
          queryFn: async () => [{ id: "c1", title: "Cookbook c1" }],
        }),
        queryKey: ({ recipeId }: { recipeId: string }) => [
          ["cookbooks", "forRecipe"],
          { input: { recipeId }, type: "query" },
        ],
      },
    },
    recipes: {
      get: {
        queryOptions: ({ id }: { id: string }) => ({
          queryKey: [["recipes", "get"], { input: { id }, type: "query" }],
          queryFn: async () => ({ id }),
        }),
        queryKey: ({ id }: { id: string }) => [
          ["recipes", "get"],
          { input: { id }, type: "query" },
        ],
      },
    },
    groceries: {
      list: {
        queryOptions: () => ({
          queryKey: [["groceries", "list"], { type: "query" }],
          queryFn: async () => ({ groceries: [{ id: "g1" }] }),
        }),
        queryKey: () => [["groceries", "list"], { type: "query" }],
      },
    },
    stores: {
      list: {
        queryOptions: () => ({
          queryKey: [["stores", "list"], { type: "query" }],
          queryFn: async () => [],
        }),
        queryKey: () => [["stores", "list"], { type: "query" }],
      },
    },
    calendar: {
      listItems: {
        queryOptions: (range: { startISO: string; endISO: string }) => ({
          queryKey: [["calendar", "listItems"], { input: range, type: "query" }],
          queryFn: async () => [],
        }),
        queryKey: (range: { startISO: string; endISO: string }) => [
          ["calendar", "listItems"],
          { input: range, type: "query" },
        ],
      },
    },
  };
}

describe("WarmSet", () => {
  beforeEach(() => {
    vi.mocked(cacheManager.owner).mockReturnValue("owner-1");
    vi.mocked(readLastWarmedAt).mockResolvedValue(123);
    vi.mocked(writeLastWarmedAt).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "locks");
  });

  it("tops the Offline Cache up to the guaranteed floor", async () => {
    const queryClient = new QueryClient();
    const warmSet = createWarmSet({ queryClient, trpc: makeTrpc() });

    await expect(warmSet.topUp()).resolves.toBe("complete");

    expect(
      queryClient.getQueryData([["recipes", "get"], { input: { id: "r1" }, type: "query" }])
    ).toEqual({ id: "r1" });
    expect(
      queryClient.getQueryData([["recipes", "get"], { input: { id: "r2" }, type: "query" }])
    ).toEqual({ id: "r2" });
    expect(queryClient.getQueryData([["groceries", "list"], { type: "query" }])).toEqual({
      groceries: [{ id: "g1" }],
    });
    expect(queryClient.getQueryData([["stores", "list"], { type: "query" }])).toEqual([]);
    expect(writeLastWarmedAt).toHaveBeenCalledWith("owner-1", expect.any(Number));
  });

  it("guarantees every cookbook the reader can see, with its membership", async () => {
    const queryClient = new QueryClient();
    const warmSet = createWarmSet({ queryClient, trpc: makeTrpc() });

    await expect(warmSet.topUp()).resolves.toBe("complete");

    // The cookbook itself, so its page opens Offline.
    expect(
      queryClient.getQueryData([["cookbooks", "get"], { input: { id: "c1" }, type: "query" }])
    ).toEqual({ id: "c1", title: "Cookbook c1" });
    // Its membership, so the page lists what is in it.
    expect(
      queryClient.getQueryData([
        ["cookbooks", "recipes"],
        { input: { cookbookId: "c1", limit: 100 }, type: "infinite" },
      ])
    ).toMatchObject({ pages: [{ recipes: [{ id: "r1" }] }] });
    // The cookbooks the reader may edit — one answer for every recipe page, so
    // filing works Offline without a read per recipe.
    expect(queryClient.getQueryData([["cookbooks", "editable"], { type: "query" }])).toEqual([
      { id: "c1", title: "Cookbook c1" },
    ]);
    // And which cookbooks hold each warmed recipe, for the recipe page's card.
    expect(
      queryClient.getQueryData([
        ["cookbooks", "forRecipe"],
        { input: { recipeId: "r1" }, type: "query" },
      ])
    ).toEqual([{ id: "c1", title: "Cookbook c1" }]);
  });

  it("keeps the member recipes' fifty-recipe guarantee and adds no new one", async () => {
    const trpc = makeTrpc();
    const manyItems = Array.from({ length: 60 }, (_unused, index) => ({
      kind: "recipe" as const,
      recipe: { id: `r${index}` },
    }));

    trpc.library.list.infiniteQueryOptions = (input: unknown, options: object) => ({
      queryKey: [["library", "list"], { input, type: "infinite" }],
      queryFn: async () => ({ items: manyItems, total: manyItems.length, nextCursor: null }),
      initialPageParam: 0,
      ...options,
    });

    const queryClient = new QueryClient();

    await createWarmSet({ queryClient, trpc }).topUp();

    const warmedDetails = queryClient
      .getQueryCache()
      .findAll({ queryKey: [["recipes", "get"]] })
      .filter((query) => query.state.data != null);

    expect(warmedDetails).toHaveLength(50);
  });

  it("inspects the same Warm Set that top-up writes", async () => {
    const queryClient = new QueryClient();
    const warmSet = createWarmSet({ queryClient, trpc: makeTrpc() });

    await warmSet.topUp();

    await expect(warmSet.inspect()).resolves.toEqual({
      recipes: 2,
      cookbooks: 1,
      groceries: 1,
      stores: 0,
      plannedThisWeek: 0,
      lastCompletedAt: 123,
    });
  });

  it("promotes a newly created recipe into the Warm Set", () => {
    const queryClient = new QueryClient();
    const trpc = makeTrpc();
    const warmSet = createWarmSet({ queryClient, trpc });
    const recipeKey = trpc.recipes.get.queryKey({ id: "new-recipe" });

    queryClient.setQueryData(recipeKey, { id: "new-recipe" });
    warmSet.promoteCreatedRecipe("new-recipe");

    expect(queryClient.getQueryCache().find({ queryKey: recipeKey })?.gcTime).toBe(604_800_000);
  });

  it("promotes a newly created cookbook into the Warm Set", () => {
    const queryClient = new QueryClient();
    const trpc = makeTrpc();
    const warmSet = createWarmSet({ queryClient, trpc });
    const cookbookKey = trpc.cookbooks.get.queryKey({ id: "new-cookbook" });

    queryClient.setQueryData(cookbookKey, { id: "new-cookbook" });
    warmSet.promoteCreatedCookbook("new-cookbook");

    // Held at the offline cache's own lifetime, so it is in the floor now
    // rather than at the next warm (ADR-0008).
    expect(queryClient.getQueryCache().find({ queryKey: cookbookKey })?.gcTime).toBe(604_800_000);
  });

  it("reports a partial top-up without stamping completion", async () => {
    const trpc = makeTrpc();

    trpc.stores.list.queryOptions = () => ({
      queryKey: [["stores", "list"], { type: "query" }],
      queryFn: async () => {
        throw new Error("backend failed mid-warm");
      },
    });

    const warmSet = createWarmSet({ queryClient: new QueryClient(), trpc });

    await expect(warmSet.topUp()).resolves.toBe("partial");
    expect(writeLastWarmedAt).not.toHaveBeenCalled();
  });

  it("reports when another tab owns Warm Set top-up", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: vi.fn(
          async (_name: string, _options: object, callback: (lock: unknown) => Promise<unknown>) =>
            callback(null)
        ),
      },
    });

    const warmSet = createWarmSet({ queryClient: new QueryClient(), trpc: makeTrpc() });

    await expect(warmSet.topUp()).resolves.toBe("not-leader");
  });

  it("stores warmed recipes' same-origin primary images", async () => {
    const trpc = makeTrpc();

    trpc.library.list.infiniteQueryOptions = (input: unknown, options: object) => ({
      queryKey: [["library", "list"], { input, type: "infinite" }],
      queryFn: async () => ({
        items: [{ kind: "recipe", recipe: { id: "r1", image: "/uploads/r1.jpg" } }],
        total: 1,
        nextCursor: null,
      }),
      initialPageParam: 0,
      ...options,
    });

    const put = vi.fn(async () => {});

    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ match: vi.fn(async () => undefined), put })),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("image", { status: 200 }))
    );

    const warmSet = createWarmSet({ queryClient: new QueryClient(), trpc });

    await expect(warmSet.topUp()).resolves.toBe("complete");
    expect(put).toHaveBeenCalledWith(
      new URL("/uploads/r1.jpg", window.location.href).toString(),
      expect.any(Response)
    );
    expect(expirationMetadata.expireEntries).toHaveBeenCalled();
  });
});
