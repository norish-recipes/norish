import type {
  WebReadCacheRecordCounts,
  WebReadCacheRecordKind,
} from "@/lib/offline-read-cache/types";
import type { Query, QueryKey } from "@tanstack/react-query";
import { hashKey } from "@tanstack/react-query";

import {
  DEFAULT_RECIPE_FILTERS,
  DEFAULT_RECIPE_LIST_LIMIT,
  toRecipesQueryFilters,
} from "@norish/shared-react/contexts";

export type OfflineReadCacheDescriptor = {
  kind: WebReadCacheRecordKind;
  queryKey: QueryKey;
  data: unknown;
  counts: Partial<WebReadCacheRecordCounts>;
};

type TrpcQueryRegistryHelpers = {
  recipes: {
    list: {
      infiniteQueryOptions: (
        input: Record<string, unknown>,
        options: Record<string, unknown>
      ) => {
        queryKey: QueryKey;
      };
    };
  };
  calendar: { listItems: { queryKey: (input: { startISO: string; endISO: string }) => QueryKey } };
  groceries: { list: { queryKey: () => QueryKey } };
  stores: { list: { queryKey: () => QueryKey } };
  households: { get: { queryKey: () => QueryKey } };
};

function sameProcedure(left: QueryKey, right: QueryKey): boolean {
  return hashKey([left[0]]) === hashKey([right[0]]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeDashboard(data: unknown): { data: unknown; recipeCount: number } | null {
  if (!isRecord(data) || !Array.isArray(data.pages) || data.pages.length === 0) return null;

  const firstPage = data.pages[0];

  if (!isRecord(firstPage) || !Array.isArray(firstPage.recipes)) return null;

  const recipes = firstPage.recipes.slice(0, DEFAULT_RECIPE_LIST_LIMIT);

  return {
    data: {
      ...data,
      pages: [{ ...firstPage, recipes, nextCursor: null }],
      pageParams: Array.isArray(data.pageParams) ? data.pageParams.slice(0, 1) : [null],
    },
    recipeCount: recipes.length,
  };
}

export function createOfflineReadCacheRegistry(trpc: TrpcQueryRegistryHelpers) {
  const dashboardQueryKey = trpc.recipes.list.infiniteQueryOptions(
    {
      limit: DEFAULT_RECIPE_LIST_LIMIT,
      ...toRecipesQueryFilters(DEFAULT_RECIPE_FILTERS),
    },
    { getNextPageParam: () => null }
  ).queryKey;
  const calendarProcedureKey = trpc.calendar.listItems.queryKey({ startISO: "", endISO: "" });
  const groceriesQueryKey = trpc.groceries.list.queryKey();
  const storesQueryKey = trpc.stores.list.queryKey();
  const householdQueryKey = trpc.households.get.queryKey();
  const dashboardHash = hashKey(dashboardQueryKey);
  const groceriesHash = hashKey(groceriesQueryKey);
  const storesHash = hashKey(storesQueryKey);
  const householdHash = hashKey(householdQueryKey);

  function classifyForPersistence(
    query: Pick<Query, "queryKey" | "meta">
  ): WebReadCacheRecordKind | null {
    const queryHash = hashKey(query.queryKey);

    if (queryHash === dashboardHash) return "recipe-dashboard";
    if (
      sameProcedure(query.queryKey, calendarProcedureKey) &&
      query.meta?.persistOfflineReadCache === true
    ) {
      return "calendar-range";
    }
    if (queryHash === groceriesHash) return "groceries";
    if (queryHash === storesHash) return "stores";

    return null;
  }

  function describe(query: Query): OfflineReadCacheDescriptor | null {
    if (query.state.status !== "success" || query.state.data === undefined) return null;

    const queryKey = query.queryKey;
    const kind = classifyForPersistence(query);

    if (kind === "recipe-dashboard") {
      const normalized = normalizeDashboard(query.state.data);

      return normalized
        ? {
            kind: "recipe-dashboard",
            queryKey,
            data: normalized.data,
            counts: { recipeSummaries: normalized.recipeCount },
          }
        : null;
    }

    if (kind === "calendar-range") {
      return Array.isArray(query.state.data)
        ? {
            kind: "calendar-range",
            queryKey,
            data: query.state.data,
            counts: { calendarItems: query.state.data.length },
          }
        : null;
    }

    if (
      kind === "groceries" &&
      isRecord(query.state.data) &&
      Array.isArray(query.state.data.groceries) &&
      Array.isArray(query.state.data.recurringGroceries) &&
      isRecord(query.state.data.recipeMap)
    ) {
      return {
        kind: "groceries",
        queryKey,
        data: query.state.data,
        counts: {
          groceries: query.state.data.groceries.length,
          recurringGroceries: query.state.data.recurringGroceries.length,
          recipeNameMappings: Object.keys(query.state.data.recipeMap).length,
        },
      };
    }

    if (kind === "stores" && Array.isArray(query.state.data)) {
      return {
        kind: "stores",
        queryKey,
        data: query.state.data,
        counts: { stores: query.state.data.length },
      };
    }

    return null;
  }

  return {
    dashboardQueryKey,
    groceriesQueryKey,
    householdQueryKey,
    classifyForPersistence,
    describe,
    isHouseholdQuery: (queryKey: QueryKey) => hashKey(queryKey) === householdHash,
  };
}
