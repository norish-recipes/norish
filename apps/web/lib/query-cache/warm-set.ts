/** The web Warm Set: top-up, inventory, and create-time promotion. */

import type { QueryClient } from "@tanstack/react-query";
import { getInitialDateRange } from "@/app/(app)/calendar/context-helpers";
import {
  IMAGE_CACHE_MAX_AGE_SECONDS,
  IMAGE_CACHE_MAX_ENTRIES,
  IMAGE_CACHE_NAME,
} from "@/lib/offline/cache-names";
import { runIfLeader } from "@/lib/outbox/leader";
import { readLastWarmedAt, writeLastWarmedAt } from "@/lib/query-cache/last-warmed";
import { CACHE_MAX_AGE_MS, cacheManager } from "@/lib/query-cache/persisted-query-client";
import { CacheExpiration } from "serwist";

import { DEFAULT_RECIPE_FILTERS, toRecipesQueryFilters } from "@norish/shared-react/contexts";
import { dateKey } from "@norish/shared/lib/helpers";

const WARM_RECIPE_LIST_LIMIT = 100;
const WARM_FULL_RECIPE_COUNT = 50;
/**
 * Cookbooks are cheap rows and there is no equivalent of the fifty-recipe
 * ceiling for them: the floor promises every one the reader can see.
 */
const WARM_COOKBOOK_LIST_LIMIT = 200;

type CalendarRange = { startISO: string; endISO: string };
type RecipeListItem = { id: string; image?: string | null };
type LibraryListItem =
  { kind: "recipe"; recipe: RecipeListItem } | { kind: "cookbook"; cookbook: { id: string } };
type LibraryListPage = { items: LibraryListItem[]; total: number; nextCursor: number | null };
type LibraryListInfiniteData = { pages: LibraryListPage[] };
type CookbookListPage = {
  cookbooks: { id: string }[];
  total: number;
  nextCursor: number | null;
};
type CookbookListInfiniteData = { pages: CookbookListPage[] };

interface WarmSetTRPC {
  cookbooks: {
    list: {
      infiniteQueryOptions: (
        input: { limit: number; sortMode: "dateDesc" },
        options: { getNextPageParam: (lastPage: CookbookListPage) => number | null }
      ) => object;
    };
    get: {
      queryOptions: (input: { id: string }) => object;
      queryKey: (input: { id: string }) => readonly unknown[];
    };
    memberIds: {
      queryOptions: (input: { cookbookId: string }) => object;
    };
    recipes: {
      infiniteQueryOptions: (
        input: { cookbookId: string; limit: number },
        options: { getNextPageParam: (lastPage: { nextCursor: number | null }) => number | null }
      ) => object;
    };
    editable: {
      queryOptions: () => object;
      queryKey: () => readonly unknown[];
    };
    forRecipe: {
      queryOptions: (input: { recipeId: string }) => object;
      queryKey: (input: { recipeId: string }) => readonly unknown[];
    };
  };
  library: {
    list: {
      infiniteQueryOptions: (
        input: ReturnType<typeof libraryListInput>,
        options: { getNextPageParam: (lastPage: LibraryListPage) => number | null }
      ) => object;
    };
  };
  recipes: {
    get: {
      queryOptions: (input: { id: string }) => object;
      queryKey: (input: { id: string }) => readonly unknown[];
    };
    memberIds: {
      queryOptions: (input: { cookbookId: string }) => object;
    };
  };
  groceries: {
    list: {
      queryOptions: () => object;
      queryKey: () => readonly unknown[];
    };
  };
  stores: {
    list: {
      queryOptions: () => object;
      queryKey: () => readonly unknown[];
    };
  };
  calendar: {
    listItems: {
      queryOptions: (range: CalendarRange) => object;
      queryKey: (range: CalendarRange) => readonly unknown[];
    };
  };
}

export type WarmSetTopUpResult = "complete" | "partial" | "not-leader";

export interface WarmSetInventory {
  recipes: number;
  cookbooks: number;
  groceries: number;
  stores: number;
  plannedThisWeek: number;
  lastCompletedAt: number | null;
}

export interface WarmSet {
  topUp(): Promise<WarmSetTopUpResult>;
  inspect(): Promise<WarmSetInventory>;
  promoteCreatedRecipe(recipeId: string): void;
  /**
   * A cookbook made while Live joins the floor now rather than at the next
   * warm, the same promise a newly created recipe gets (ADR-0008).
   */
  promoteCreatedCookbook(cookbookId: string): void;
}

export function createWarmSet({
  queryClient,
  trpc: untypedTrpc,
}: {
  queryClient: QueryClient;
  trpc: unknown;
}): WarmSet {
  const trpc = untypedTrpc as WarmSetTRPC;

  return {
    async topUp() {
      const result = await runIfLeader(async () => {
        const [warmed, listsComplete] = await Promise.all([
          warmLibrary(trpc, queryClient),
          warmLists(trpc, queryClient),
        ]);
        const owner = cacheManager.owner();
        const complete = warmed && listsComplete && owner !== null;

        if (complete) {
          try {
            await writeLastWarmedAt(owner, Date.now());
          } catch {
            return "partial" as const;
          }
        }

        return complete ? ("complete" as const) : ("partial" as const);
      });

      return result ?? "not-leader";
    },

    async inspect() {
      const owner = cacheManager.owner();
      const desktopRange = calendarRanges()[0];
      const recipePath = [trpc.recipes.get.queryKey({ id: "" })[0]];
      const recipes = queryClient
        .getQueryCache()
        .findAll({ queryKey: recipePath })
        .filter((query) => query.state.data != null).length;
      const cookbookPath = [trpc.cookbooks.get.queryKey({ id: "" })[0]];
      const cookbooks = queryClient
        .getQueryCache()
        .findAll({ queryKey: cookbookPath })
        .filter((query) => query.state.data != null).length;
      const groceriesData = queryClient.getQueryData(trpc.groceries.list.queryKey()) as
        { groceries?: unknown[] } | undefined;
      const storesData = queryClient.getQueryData(trpc.stores.list.queryKey()) as
        unknown[] | undefined;
      const plannedData = queryClient.getQueryData(
        trpc.calendar.listItems.queryKey(desktopRange)
      ) as unknown[] | undefined;

      return {
        recipes,
        cookbooks,
        groceries: groceriesData?.groceries?.length ?? 0,
        stores: storesData?.length ?? 0,
        plannedThisWeek: plannedData?.length ?? 0,
        lastCompletedAt: owner ? await readLastWarmedAt(owner) : null,
      };
    },

    promoteCreatedRecipe(recipeId) {
      promote(queryClient, trpc.recipes.get.queryKey({ id: recipeId }));
    },

    promoteCreatedCookbook(cookbookId) {
      promote(queryClient, trpc.cookbooks.get.queryKey({ id: cookbookId }));
    },
  };
}

/**
 * The Library's own first page, under the reader's default filters — the same
 * input the dashboard asks for, so the guaranteed floor and the reader's first
 * paint are one cache entry (ADR-0009).
 */
function libraryListInput() {
  return {
    limit: WARM_RECIPE_LIST_LIMIT,
    ...toRecipesQueryFilters(DEFAULT_RECIPE_FILTERS),
  };
}

function calendarRanges(): CalendarRange[] {
  return (["desktop", "mobile"] as const).map((mode) => {
    const { start, end } = getInitialDateRange(mode);

    return { startISO: dateKey(start), endISO: dateKey(end) };
  });
}

function withWarmGcTime<T extends object>(options: T): T {
  return { ...options, gcTime: CACHE_MAX_AGE_MS };
}

/** Hold a cached read at the offline cache's own lifetime. */
function promote(queryClient: QueryClient, queryKey: readonly unknown[]): void {
  const query = queryClient.getQueryCache().find({ queryKey });

  if (query) {
    query.updateGcTime(CACHE_MAX_AGE_MS);
    query.scheduleGc();
  }
}

/**
 * The Library's floor: every cookbook the reader can see with its membership,
 * and the first fifty member recipes in full.
 *
 * Cookbooks come down with the list itself, so what needs warming beside it is
 * each cookbook's own page — its summary and its member list — plus the
 * cookbooks the reader may edit, which is what lets filing work Offline. That
 * last read is deliberately not per recipe: one answer serves every recipe
 * page. Member recipes keep the existing fifty-recipe guarantee and gain no
 * new one, so a cookbook page Offline may list a member whose detail was never
 * cached — which renders the existing unavailable-offline treatment rather
 * than failing (ADR-0009).
 */
async function warmLibrary(trpc: WarmSetTRPC, queryClient: QueryClient): Promise<boolean> {
  const listOptions = withWarmGcTime(
    trpc.library.list.infiniteQueryOptions(libraryListInput(), {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    })
  );
  let data: unknown;

  try {
    data = await queryClient.fetchInfiniteQuery(listOptions as never);
  } catch {
    return false;
  }

  // Cookbooks come down with the list itself; only the member recipes need
  // their details warming, and they keep the existing fifty-recipe guarantee.
  const recipes = extractRecipeListItems(data).slice(0, WARM_FULL_RECIPE_COUNT);
  // Every cookbook, not just the ones the first Library page happened to hold:
  // a Library dominated by recent recipes would otherwise leave older
  // cookbooks outside the floor, and the guarantee is "every cookbook the
  // reader can see" (ADR-0009).
  const cookbookIds = await warmedCookbookIds(trpc, queryClient);
  const [detailResults, cookbookResults, imagesComplete] = await Promise.all([
    Promise.allSettled(
      recipes.map(({ id }) =>
        queryClient.fetchQuery(withWarmGcTime(trpc.recipes.get.queryOptions({ id })) as never)
      )
    ),
    Promise.allSettled([
      queryClient.fetchQuery(withWarmGcTime(trpc.cookbooks.editable.queryOptions()) as never),
      ...cookbookIds.flatMap((id) => [
        queryClient.fetchQuery(withWarmGcTime(trpc.cookbooks.get.queryOptions({ id })) as never),
        // Ids only, and what the bulk-add panel needs to leave out what is
        // already in a cookbook — Offline it would otherwise offer to add
        // every member back.
        queryClient.fetchQuery(
          withWarmGcTime(trpc.cookbooks.memberIds.queryOptions({ cookbookId: id })) as never
        ),
        queryClient.fetchInfiniteQuery(
          withWarmGcTime(
            trpc.cookbooks.recipes.infiniteQueryOptions(
              { cookbookId: id, limit: WARM_RECIPE_LIST_LIMIT },
              { getNextPageParam: (lastPage) => lastPage.nextCursor }
            )
          ) as never
        ),
      ]),
      ...recipes.map(({ id }) =>
        queryClient.fetchQuery(
          withWarmGcTime(trpc.cookbooks.forRecipe.queryOptions({ recipeId: id })) as never
        )
      ),
    ]),
    warmPrimaryImages(recipes),
  ]);

  return (
    detailResults.every((result) => result.status === "fulfilled") &&
    cookbookResults.every((result) => result.status === "fulfilled") &&
    imagesComplete
  );
}

async function warmLists(trpc: WarmSetTRPC, queryClient: QueryClient): Promise<boolean> {
  const results = await Promise.allSettled([
    queryClient.fetchQuery(withWarmGcTime(trpc.groceries.list.queryOptions()) as never),
    queryClient.fetchQuery(withWarmGcTime(trpc.stores.list.queryOptions()) as never),
    ...calendarRanges().map((range) =>
      queryClient.fetchQuery(withWarmGcTime(trpc.calendar.listItems.queryOptions(range)) as never)
    ),
  ]);

  return results.every((result) => result.status === "fulfilled");
}

async function warmPrimaryImages(recipes: RecipeListItem[]): Promise<boolean> {
  const urls = recipes
    .map((recipe) => sameOriginImageUrl(recipe.image))
    .filter((url): url is string => url !== null);

  if (urls.length === 0) {
    return true;
  }

  if (typeof caches === "undefined" || typeof fetch !== "function") {
    return false;
  }

  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const expiration = new CacheExpiration(IMAGE_CACHE_NAME, {
      maxEntries: IMAGE_CACHE_MAX_ENTRIES,
      maxAgeSeconds: IMAGE_CACHE_MAX_AGE_SECONDS,
    });
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          if (await cache.match(url)) {
            await expiration.updateTimestamp(url);

            return true;
          }

          const response = await fetch(url);

          if (!response.ok) {
            return false;
          }

          await cache.put(url, response);
          await expiration.updateTimestamp(url);

          return true;
        } catch {
          return false;
        }
      })
    );

    await expiration.expireEntries();

    return results.every(Boolean);
  } catch {
    return false;
  }
}

function sameOriginImageUrl(image: string | null | undefined): string | null {
  if (!image || typeof location === "undefined") {
    return null;
  }

  try {
    const url = new URL(image, location.href);

    return url.origin === location.origin ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Every cookbook the reader can see, read through the cookbook list's own
 * pagination so the count is not capped by whatever the Library page held.
 * Returns what it managed to read; a failure surfaces as a partial top-up
 * through the fetches that follow.
 */
async function warmedCookbookIds(trpc: WarmSetTRPC, queryClient: QueryClient): Promise<string[]> {
  try {
    const data = (await queryClient.fetchInfiniteQuery(
      withWarmGcTime(
        trpc.cookbooks.list.infiniteQueryOptions(
          { limit: WARM_COOKBOOK_LIST_LIMIT, sortMode: "dateDesc" },
          { getNextPageParam: (lastPage) => lastPage.nextCursor }
        )
      ) as never
    )) as CookbookListInfiniteData | undefined;

    return data?.pages?.flatMap((page) => page.cookbooks.map((cookbook) => cookbook.id)) ?? [];
  } catch {
    return [];
  }
}

function extractRecipeListItems(data: unknown): RecipeListItem[] {
  const infinite = data as LibraryListInfiniteData | undefined;

  return (
    infinite?.pages?.flatMap((page) =>
      page.items.flatMap((item) => (item.kind === "recipe" ? [item.recipe] : []))
    ) ?? []
  );
}
