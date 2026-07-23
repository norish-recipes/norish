/** The web Warm Set: top-up, inventory, and create-time promotion. */

import type { QueryClient } from "@tanstack/react-query";
import { getInitialDateRange } from "@/app/(app)/calendar/context-helpers";
import {
  IMAGE_CACHE_MAX_AGE_SECONDS,
  IMAGE_CACHE_MAX_ENTRIES,
  IMAGE_CACHE_NAME,
} from "@/lib/offline/cache-names";
import { runIfLeader } from "@/lib/outbox/leader";
import { CacheExpiration } from "serwist";

import { DEFAULT_RECIPE_FILTERS, toRecipesQueryFilters } from "@norish/shared-react/contexts";
import { dateKey } from "@norish/shared/lib/helpers";

import { readLastWarmedAt, writeLastWarmedAt } from "./last-warmed";
import { activeCacheOwner, CACHE_MAX_AGE_MS } from "./persisted-query-client";

const WARM_RECIPE_LIST_LIMIT = 100;
const WARM_FULL_RECIPE_COUNT = 50;

type CalendarRange = { startISO: string; endISO: string };
type RecipeListItem = { id: string; image?: string | null };
type RecipeListPage = { recipes: RecipeListItem[]; total: number; nextCursor: number | null };
type RecipeListInfiniteData = { pages: RecipeListPage[] };

interface WarmSetTRPC {
  recipes: {
    list: {
      infiniteQueryOptions: (
        input: ReturnType<typeof recipeListInput>,
        options: { getNextPageParam: (lastPage: RecipeListPage) => number | null }
      ) => object;
    };
    get: {
      queryOptions: (input: { id: string }) => object;
      queryKey: (input: { id: string }) => readonly unknown[];
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
  groceries: number;
  stores: number;
  plannedThisWeek: number;
  lastCompletedAt: number | null;
}

export interface WarmSet {
  topUp(): Promise<WarmSetTopUpResult>;
  inspect(): Promise<WarmSetInventory>;
  promoteCreatedRecipe(recipeId: string): void;
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
        const [recipesComplete, listsComplete] = await Promise.all([
          warmRecipes(trpc, queryClient),
          warmLists(trpc, queryClient),
        ]);
        const owner = activeCacheOwner();
        const complete = recipesComplete && listsComplete && owner !== null;

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
      const owner = activeCacheOwner();
      const desktopRange = calendarRanges()[0];
      const recipePath = [trpc.recipes.get.queryKey({ id: "" })[0]];
      const recipes = queryClient
        .getQueryCache()
        .findAll({ queryKey: recipePath })
        .filter((query) => query.state.data != null).length;
      const groceriesData = queryClient.getQueryData(trpc.groceries.list.queryKey()) as
        | { groceries?: unknown[] }
        | undefined;
      const storesData = queryClient.getQueryData(trpc.stores.list.queryKey()) as
        | unknown[]
        | undefined;
      const plannedData = queryClient.getQueryData(
        trpc.calendar.listItems.queryKey(desktopRange)
      ) as unknown[] | undefined;

      return {
        recipes,
        groceries: groceriesData?.groceries?.length ?? 0,
        stores: storesData?.length ?? 0,
        plannedThisWeek: plannedData?.length ?? 0,
        lastCompletedAt: owner ? await readLastWarmedAt(owner) : null,
      };
    },

    promoteCreatedRecipe(recipeId) {
      const queryKey = trpc.recipes.get.queryKey({ id: recipeId });
      const query = queryClient.getQueryCache().find({ queryKey });

      if (query) {
        query.updateGcTime(CACHE_MAX_AGE_MS);
        query.scheduleGc();
      }
    },
  };
}

function recipeListInput() {
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

async function warmRecipes(trpc: WarmSetTRPC, queryClient: QueryClient): Promise<boolean> {
  const listOptions = withWarmGcTime(
    trpc.recipes.list.infiniteQueryOptions(recipeListInput(), {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    })
  );
  let data: unknown;

  try {
    data = await queryClient.fetchInfiniteQuery(listOptions as never);
  } catch {
    return false;
  }

  const recipes = extractRecipeListItems(data).slice(0, WARM_FULL_RECIPE_COUNT);
  const [detailResults, imagesComplete] = await Promise.all([
    Promise.allSettled(
      recipes.map(({ id }) =>
        queryClient.fetchQuery(withWarmGcTime(trpc.recipes.get.queryOptions({ id })) as never)
      )
    ),
    warmPrimaryImages(recipes),
  ]);

  return detailResults.every((result) => result.status === "fulfilled") && imagesComplete;
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

function extractRecipeListItems(data: unknown): RecipeListItem[] {
  const infinite = data as RecipeListInfiniteData | undefined;

  return infinite?.pages?.flatMap((page) => page.recipes) ?? [];
}
