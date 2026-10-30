import type { TRPCLink } from "@trpc/client";
import { readLastWarmedAt, writeLastWarmedAt } from "@/lib/query-cache/last-warmed";
import { CACHE_MAX_AGE_MS, cacheManager } from "@/lib/query-cache/persisted-query-client";
import { createWarmSet } from "@/lib/query-cache/warm-set";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";
import {
  DEFAULT_RECIPE_FILTERS,
  toRecipesQueryFilters,
} from "@norish/shared-react/filter-contract";
import { cookbookRecipesInput } from "@norish/shared-react/list-queries";

const expirationMetadata = vi.hoisted(() => ({
  updateTimestamp: vi.fn(async (_url: string) => {}),
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

type Answer = (input: { id?: string }) => unknown;

/** What the server answers each procedure the Warm Set reads. */
function answers(): Record<string, Answer> {
  return {
    // The Library is what the Warm Set warms: one interleaved list holding
    // both kinds (ADR-0026).
    "library.list": () => ({
      items: [
        { kind: "recipe", recipe: { id: "r1" } },
        { kind: "recipe", recipe: { id: "r2" } },
        { kind: "cookbook", cookbook: { id: "c1" } },
      ],
      total: 3,
      nextCursor: null,
    }),
    "cookbooks.list": () => ({ cookbooks: [{ id: "c1" }], total: 1, nextCursor: null }),
    "cookbooks.get": ({ id }) => ({ id, title: `Cookbook ${id}` }),
    "cookbooks.memberIds": () => ["r1"],
    "cookbooks.recipes": () => ({ recipes: [{ id: "r1" }], total: 1, nextCursor: null }),
    "cookbooks.editable": () => [{ id: "c1", title: "Cookbook c1" }],
    "cookbooks.forRecipe": () => [{ id: "c1", title: "Cookbook c1" }],
    "recipes.get": ({ id }) => ({ id }),
    "groceries.list": () => ({ groceries: [{ id: "g1" }] }),
    "stores.list": () => [],
    "stores.aisleLinks": () => [],
    "pantry.list": () => [],
    "user.get": () => ({ user: { id: "owner-1", preferences: {} }, apiKeys: [] }),
    "calendar.listItems": () => [],
  };
}

/** The app's own tRPC options proxy, over a link that answers from `served`. */
function makeTrpc(queryClient: QueryClient, served: Record<string, Answer> = answers()) {
  const link: TRPCLink<AppRouter> =
    () =>
    ({ op }) =>
      observable((observer) => {
        Promise.resolve()
          .then(() => served[op.path]?.(op.input as { id?: string }))
          .then(
            (data) => {
              observer.next({ result: { type: "data", data } });
              observer.complete();
            },
            (error: Error) => observer.error(TRPCClientError.from(error))
          );
      });

  return createTRPCOptionsProxy<AppRouter>({
    client: createTRPCClient<AppRouter>({ links: [link] }),
    queryClient,
  });
}

function makeWarmSet(served?: Record<string, Answer>) {
  const queryClient = new QueryClient();

  return {
    queryClient,
    warmSet: createWarmSet({ queryClient, trpc: makeTrpc(queryClient, served) }),
  };
}

/** A Library page of the given recipes and nothing else. */
function libraryOf(recipes: { id: string; image?: string }[]): Record<string, Answer> {
  return {
    ...answers(),
    "library.list": () => ({
      items: recipes.map((recipe) => ({ kind: "recipe", recipe })),
      total: recipes.length,
      nextCursor: null,
    }),
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
    const { queryClient, warmSet } = makeWarmSet();

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
    // The profile, so Offline start-up draws the reader's Device Preferences.
    expect(queryClient.getQueryData([["user", "get"], { type: "query" }])).toMatchObject({
      user: { id: "owner-1" },
    });
    // Everything warmed is held as long as the offline cache itself.
    for (const query of queryClient.getQueryCache().getAll()) {
      expect(query.gcTime, query.queryHash).toBe(CACHE_MAX_AGE_MS);
    }
    expect(writeLastWarmedAt).toHaveBeenCalledWith("owner-1", expect.any(Number));
  });

  it("guarantees every cookbook the reader can see, with its membership", async () => {
    const { queryClient, warmSet } = makeWarmSet();

    await expect(warmSet.topUp()).resolves.toBe("complete");

    // The cookbook itself, so its page opens Offline.
    expect(
      queryClient.getQueryData([["cookbooks", "get"], { input: { id: "c1" }, type: "query" }])
    ).toEqual({ id: "c1", title: "Cookbook c1" });
    // Its membership, under the input the cookbook page asks with, so the page lists it Offline.
    expect(
      queryClient.getQueryData([
        ["cookbooks", "recipes"],
        {
          input: cookbookRecipesInput("c1", toRecipesQueryFilters(DEFAULT_RECIPE_FILTERS)),
          type: "infinite",
        },
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

  it("warms every cookbook, not just the ones the first Library page held", async () => {
    // A Library page of nothing but recipes: an older cookbook would fall
    // outside the floor if the warm read cookbooks off this page.
    const { queryClient, warmSet } = makeWarmSet(libraryOf([{ id: "r1" }]));

    await expect(warmSet.topUp()).resolves.toBe("complete");

    expect(
      queryClient.getQueryData([["cookbooks", "get"], { input: { id: "c1" }, type: "query" }])
    ).toEqual({ id: "c1", title: "Cookbook c1" });
  });

  it("keeps the member recipes' fifty-recipe guarantee and adds no new one", async () => {
    const { queryClient, warmSet } = makeWarmSet(
      libraryOf(Array.from({ length: 60 }, (_unused, index) => ({ id: `r${index}` })))
    );

    await warmSet.topUp();

    const warmedDetails = queryClient
      .getQueryCache()
      .findAll({ queryKey: [["recipes", "get"]] })
      .filter((query) => query.state.data != null);

    expect(warmedDetails).toHaveLength(50);
  });

  it("inspects the same Warm Set that top-up writes", async () => {
    const { warmSet } = makeWarmSet();

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

  it("reports a partial top-up without stamping completion", async () => {
    const { warmSet } = makeWarmSet({
      ...answers(),
      "stores.list": () => {
        throw new Error("backend failed mid-warm");
      },
    });

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

    const { warmSet } = makeWarmSet();

    await expect(warmSet.topUp()).resolves.toBe("not-leader");
  });

  it("stores warmed recipes' same-origin primary images", async () => {
    const put = vi.fn(async () => {});

    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ match: vi.fn(async () => undefined), put })),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("image", { status: 200 }))
    );

    const { warmSet } = makeWarmSet(libraryOf([{ id: "r1", image: "/uploads/r1.jpg" }]));

    await expect(warmSet.topUp()).resolves.toBe("complete");
    expect(put).toHaveBeenCalledWith(
      new URL("/uploads/r1.jpg", window.location.href).toString(),
      expect.any(Response)
    );
    expect(expirationMetadata.expireEntries).toHaveBeenCalled();
  });
});
