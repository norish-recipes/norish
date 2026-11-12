/** The Warm Set: top-up and inventory. */

import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { CalendarRange } from "@norish/shared/lib/helpers";
import type { AppRouter } from "@norish/trpc/client";
import {
  DEFAULT_RECIPE_FILTERS,
  toRecipesQueryFilters,
} from "@norish/shared/contracts/filter-contract";
import {
  byNextCursor,
  cookbookRecipesInput,
  libraryListInput,
} from "@norish/shared/contracts/list-queries";

import type { LockManagerLike } from "./leader";
import type { OfflineStorage } from "./storage";
import { CACHE_MAX_AGE_MS } from "./cache-manager";
import { readLastWarmedAt, writeLastWarmedAt } from "./last-warmed";
import { runIfLeader } from "./leader";

const WARM_RECIPE_LIST_LIMIT = 100;
const WARM_FULL_RECIPE_COUNT = 50;
/**
 * Cookbooks are cheap rows and there is no equivalent of the fifty-recipe
 * ceiling for them: the floor promises every one the reader can see.
 */
const WARM_COOKBOOK_LIST_LIMIT = 200;

type WarmSetTRPC = TRPCOptionsProxy<AppRouter>;
export type WarmedRecipe = { id: string; image?: string | null };

type WarmSetTopUpResult = "complete" | "partial" | "not-leader";

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

export interface WarmSetDependencies {
  queryClient: QueryClient;
  trpc: WarmSetTRPC;
  owner: () => string | null;
  keyval: OfflineStorage["keyval"];
  locks?: () => LockManagerLike | null;
  /** The calendar's initial view windows, this week's first; read on every call. */
  calendarRanges: () => CalendarRange[];
  /** Keep the warmed recipes' primary images; resolves false when one is missing. */
  warmImages?: (recipes: WarmedRecipe[]) => Promise<boolean>;
}

export function createWarmSet({
  queryClient,
  trpc,
  owner: currentOwner,
  keyval,
  locks = () => null,
  calendarRanges,
  warmImages = async () => true,
}: WarmSetDependencies): WarmSet {
  return {
    async topUp() {
      const result = await runIfLeader(async () => {
        const [warmed, listsComplete] = await Promise.all([
          warmLibrary(trpc, queryClient, warmImages),
          warmLists(trpc, queryClient, calendarRanges()),
        ]);
        const owner = currentOwner();
        const complete = warmed && listsComplete && owner !== null;

        if (complete) {
          try {
            await writeLastWarmedAt(owner, Date.now(), keyval);
          } catch {
            return "partial" as const;
          }
        }

        return complete ? ("complete" as const) : ("partial" as const);
      }, locks());

      return result ?? "not-leader";
    },

    async inspect() {
      const owner = currentOwner();
      const [thisWeek] = calendarRanges();
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
      const plannedData = thisWeek
        ? queryClient.getQueryData(trpc.calendar.listItems.queryKey(thisWeek))
        : undefined;

      return {
        recipes,
        cookbooks,
        groceries: groceriesData?.groceries.length ?? 0,
        stores: storesData?.length ?? 0,
        plannedThisWeek: plannedData?.length ?? 0,
        lastCompletedAt: owner ? await readLastWarmedAt(owner, keyval) : null,
      };
    },
  };
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
async function warmLibrary(
  trpc: WarmSetTRPC,
  queryClient: QueryClient,
  warmImages: (recipes: WarmedRecipe[]) => Promise<boolean>
): Promise<boolean> {
  const listOptions = withWarmGcTime(
    // The Library's first page under the default filters, as the dashboard asks for it, so the
    // guaranteed floor and the reader's first paint are one cache entry (ADR-0009).
    trpc.library.list.infiniteQueryOptions(
      libraryListInput({
        ...toRecipesQueryFilters(DEFAULT_RECIPE_FILTERS),
        limit: WARM_RECIPE_LIST_LIMIT,
      }),
      byNextCursor
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
              byNextCursor
            )
          )
        ),
      ]),
      ...recipes.map(({ id }) =>
        queryClient.query(withWarmGcTime(trpc.cookbooks.forRecipe.queryOptions({ recipeId: id })))
      ),
    ]),
    warmImages(recipes),
  ]);

  return (
    detailResults.every((result) => result.status === "fulfilled") &&
    cookbookResults.every((result) => result.status === "fulfilled") &&
    imagesComplete
  );
}

async function warmLists(
  trpc: WarmSetTRPC,
  queryClient: QueryClient,
  calendarRanges: CalendarRange[]
): Promise<boolean> {
  const results = await Promise.allSettled([
    queryClient.query(withWarmGcTime(trpc.groceries.list.queryOptions())),
    queryClient.query(withWarmGcTime(trpc.stores.list.queryOptions())),
    // Where each Store files each name; without it an offline list is one flat
    // block per Store.
    queryClient.query(withWarmGcTime(trpc.stores.aisleLinks.queryOptions())),
    // What the household has at home; without it an offline recipe adds every
    // staple to the list.
    queryClient.query(withWarmGcTime(trpc.pantry.list.queryOptions())),
    // The reader's Device Preferences, so Offline start-up draws them.
    queryClient.query(withWarmGcTime(trpc.user.getDevicePreferences.queryOptions())),
    ...calendarRanges.map((range) =>
      queryClient.query(withWarmGcTime(trpc.calendar.listItems.queryOptions(range)))
    ),
  ]);

  return results.every((result) => result.status === "fulfilled");
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
