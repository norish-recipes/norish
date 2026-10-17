/** The web Warm Set: top-up and inventory. */

import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
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

import type { AppRouter } from "@norish/trpc/client";
import {
  cookbookRecipesInput,
  DEFAULT_RECIPE_FILTERS,
  libraryListInput,
  toRecipesQueryFilters,
} from "@norish/shared-react/filter-contract";
import { dateKey } from "@norish/shared/lib/helpers";

const WARM_RECIPE_LIST_LIMIT = 100;
const WARM_FULL_RECIPE_COUNT = 50;
/**
 * Cookbooks are cheap rows and there is no equivalent of the fifty-recipe
 * ceiling for them: the floor promises every one the reader can see.
 */
const WARM_COOKBOOK_LIST_LIMIT = 200;

type WarmSetTRPC = TRPCOptionsProxy<AppRouter>;
type CalendarRange = { startISO: string; endISO: string };
type RecipeListItem = { id: string; image?: string | null };

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
}

export function createWarmSet({
  queryClient,
  trpc,
}: {
  queryClient: QueryClient;
  trpc: WarmSetTRPC;
}): WarmSet {
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
      const desktopRange = calendarRange("desktop");
      const recipePath = trpc.recipes.get.pathKey();
      const recipes = queryClient
        .getQueryCache()
        .findAll({ queryKey: recipePath })
        .filter((query) => query.state.data != null).length;
      const cookbookPath = trpc.cookbooks.get.pathKey();
      const cookbooks = queryClient
        .getQueryCache()
        .findAll({ queryKey: cookbookPath })
        .filter((query) => query.state.data != null).length;
      const groceriesData = queryClient.getQueryData(trpc.groceries.list.queryKey());
      const storesData = queryClient.getQueryData(trpc.stores.list.queryKey());
      const plannedData = queryClient.getQueryData(trpc.calendar.listItems.queryKey(desktopRange));

      return {
        recipes,
        cookbooks,
        groceries: groceriesData?.groceries.length ?? 0,
        stores: storesData?.length ?? 0,
        plannedThisWeek: plannedData?.length ?? 0,
        lastCompletedAt: owner ? await readLastWarmedAt(owner) : null,
      };
    },
  };
}

function calendarRange(mode: "desktop" | "mobile"): CalendarRange {
  const { start, end } = getInitialDateRange(mode);

  return { startISO: dateKey(start), endISO: dateKey(end) };
}

function calendarRanges(): CalendarRange[] {
  return (["desktop", "mobile"] as const).map(calendarRange);
}

function withWarmGcTime<T extends object>(options: T): T {
  return { ...options, gcTime: CACHE_MAX_AGE_MS };
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
    // The Library's first page under the default filters, as the dashboard asks for it, so the
    // guaranteed floor and the reader's first paint are one cache entry (ADR-0009).
    trpc.library.list.infiniteQueryOptions(
      libraryListInput({
        ...toRecipesQueryFilters(DEFAULT_RECIPE_FILTERS),
        limit: WARM_RECIPE_LIST_LIMIT,
      }),
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    )
  );
  const data = await queryClient.infiniteQuery(listOptions).catch(() => null);

  if (!data) {
    return false;
  }

  // Cookbooks come down with the list itself; only the member recipes need
  // their details warming, and they keep the existing fifty-recipe guarantee.
  const recipes = data.pages
    .flatMap((page) => page.items.flatMap((item) => (item.kind === "recipe" ? [item.recipe] : [])))
    .slice(0, WARM_FULL_RECIPE_COUNT);
  // Every cookbook, not just the ones the first Library page happened to hold:
  // a Library dominated by recent recipes would otherwise leave older
  // cookbooks outside the floor, and the guarantee is "every cookbook the
  // reader can see" (ADR-0009).
  const cookbookIds = await warmedCookbookIds(trpc, queryClient);
  const [detailResults, cookbookResults, imagesComplete] = await Promise.all([
    Promise.allSettled(
      recipes.map(({ id }) =>
        queryClient.query(withWarmGcTime(trpc.recipes.get.queryOptions({ id })))
      )
    ),
    Promise.allSettled([
      queryClient.query(withWarmGcTime(trpc.cookbooks.editable.queryOptions())),
      ...cookbookIds.flatMap((id) => [
        queryClient.query(withWarmGcTime(trpc.cookbooks.get.queryOptions({ id }))),
        // Ids only, and what the bulk-add panel needs to leave out what is
        // already in a cookbook — Offline it would otherwise offer to add
        // every member back.
        queryClient.query(
          withWarmGcTime(trpc.cookbooks.memberIds.queryOptions({ cookbookId: id }))
        ),
        // The cookbook page's own first page under the default filters, so Offline it reads this.
        queryClient.infiniteQuery(
          withWarmGcTime(
            trpc.cookbooks.recipes.infiniteQueryOptions(
              cookbookRecipesInput(id, toRecipesQueryFilters(DEFAULT_RECIPE_FILTERS)),
              { getNextPageParam: (lastPage) => lastPage.nextCursor }
            )
          )
        ),
      ]),
      ...recipes.map(({ id }) =>
        queryClient.query(withWarmGcTime(trpc.cookbooks.forRecipe.queryOptions({ recipeId: id })))
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
    queryClient.query(withWarmGcTime(trpc.groceries.list.queryOptions())),
    queryClient.query(withWarmGcTime(trpc.stores.list.queryOptions())),
    // Where each Store files each name; without it an offline list is one flat
    // block per Store.
    queryClient.query(withWarmGcTime(trpc.stores.aisleLinks.queryOptions())),
    // What the household has at home; without it an offline recipe adds every
    // staple to the list.
    queryClient.query(withWarmGcTime(trpc.pantry.list.queryOptions())),
    // The profile; it carries the reader's Device Preferences for Offline start-up.
    queryClient.query(withWarmGcTime(trpc.user.get.queryOptions())),
    ...calendarRanges().map((range) =>
      queryClient.query(withWarmGcTime(trpc.calendar.listItems.queryOptions(range)))
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
    const data = await queryClient.infiniteQuery(
      withWarmGcTime(
        trpc.cookbooks.list.infiniteQueryOptions(
          { limit: WARM_COOKBOOK_LIST_LIMIT, sortMode: "dateDesc" },
          { getNextPageParam: (lastPage) => lastPage.nextCursor }
        )
      )
    );

    return data.pages.flatMap((page) => page.cookbooks.map((cookbook) => cookbook.id));
  } catch {
    return [];
  }
}
