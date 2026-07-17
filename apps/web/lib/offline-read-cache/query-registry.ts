import type { Query, QueryKey } from "@tanstack/react-query";
import { hashKey } from "@tanstack/react-query";

import { DEFAULT_SEARCH_FIELDS } from "@norish/shared/contracts";

import type { WebReadCacheRecordCounts, WebReadCacheRecordKind } from "./types";

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
    get: { queryKey: (input: { id: string }) => QueryKey };
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

  const recipes = firstPage.recipes.slice(0, 100);

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
      limit: 100,
      search: undefined,
      searchFields: [...DEFAULT_SEARCH_FIELDS],
      tags: undefined,
      categories: undefined,
      filterMode: "AND",
      sortMode: "dateDesc",
      minRating: undefined,
      maxCookingTime: undefined,
    },
    { getNextPageParam: () => null }
  ).queryKey;
  const recipeDetailProcedureKey = trpc.recipes.get.queryKey({ id: "" });
  const calendarProcedureKey = trpc.calendar.listItems.queryKey({ startISO: "", endISO: "" });
  const groceriesQueryKey = trpc.groceries.list.queryKey();
  const storesQueryKey = trpc.stores.list.queryKey();
  const householdQueryKey = trpc.households.get.queryKey();
  const dashboardHash = hashKey(dashboardQueryKey);
  const groceriesHash = hashKey(groceriesQueryKey);
  const storesHash = hashKey(storesQueryKey);

  function describe(query: Query): OfflineReadCacheDescriptor | null {
    if (query.state.status !== "success" || query.state.data === undefined) return null;

    const queryKey = query.queryKey;
    const queryHash = hashKey(queryKey);

    if (queryHash === dashboardHash) {
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

    if (sameProcedure(queryKey, recipeDetailProcedureKey)) {
      return isRecord(query.state.data)
        ? {
            kind: "recipe-detail",
            queryKey,
            data: query.state.data,
            counts: { recipeDetails: 1 },
          }
        : null;
    }

    if (
      sameProcedure(queryKey, calendarProcedureKey) &&
      query.meta?.persistOfflineReadCache === true
    ) {
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
      queryHash === groceriesHash &&
      isRecord(query.state.data) &&
      Array.isArray(query.state.data.groceries) &&
      Array.isArray(query.state.data.recurringGroceries) &&
      isRecord(query.state.data.recipeMap)
    ) {
      const groceries = Array.isArray(query.state.data.groceries)
        ? query.state.data.groceries.length
        : 0;
      const recurringGroceries = Array.isArray(query.state.data.recurringGroceries)
        ? query.state.data.recurringGroceries.length
        : 0;
      const recipeNameMappings = isRecord(query.state.data.recipeMap)
        ? Object.keys(query.state.data.recipeMap).length
        : 0;

      return {
        kind: "groceries",
        queryKey,
        data: query.state.data,
        counts: { groceries, recurringGroceries, recipeNameMappings },
      };
    }

    if (queryHash === storesHash && Array.isArray(query.state.data)) {
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
    storesQueryKey,
    householdQueryKey,
    describe,
    isHouseholdQuery: (queryKey: QueryKey) => hashKey(queryKey) === hashKey(householdQueryKey),
  };
}
