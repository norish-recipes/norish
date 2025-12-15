"use client";

import type { RecipeDashboardDTO } from "@/types";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import { useQueryClient, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

export type RecipeFilters = {
  search?: string;
  tags?: string[];
  filterMode?: "AND" | "OR";
  sortMode?: "titleAsc" | "titleDesc" | "dateAsc" | "dateDesc";
};

type InfiniteRecipeData = InfiniteData<{
  recipes: RecipeDashboardDTO[];
  total: number;
  nextCursor: number | null;
}>;

const PENDING_RECIPES_KEY = ["recipes", "pending"];

export type RecipesQueryResult = {
  recipes: RecipeDashboardDTO[];
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  hasMore: boolean;
  error: unknown;
  queryKey: QueryKey;
  pendingRecipeIds: Set<string>;
  loadMore: () => void;
  addPendingRecipe: (id: string) => void;
  removePendingRecipe: (id: string) => void;
  setRecipesData: (
    updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined
  ) => void;
  setAllRecipesData: (
    updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined
  ) => void;
  invalidate: () => void;
};

export function useRecipesQuery(filters: RecipeFilters = {}): RecipesQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { search, tags, filterMode = "OR", sortMode = "dateDesc" } = filters;

  // Use pending recipes from the query cache (shared across all hook instances)
  // Store as array to ensure React Query re-renders on changes
  const pendingQuery = useQuery({
    queryKey: PENDING_RECIPES_KEY,
    queryFn: () => [] as string[],
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const pendingRecipeIds = useMemo(() => new Set(pendingQuery.data ?? []), [pendingQuery.data]);

  const infiniteQueryOptions = trpc.recipes.list.infiniteQueryOptions(
    { limit: 50, search, tags, filterMode, sortMode },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // The actual query key used by the infinite query
  const queryKey = infiniteQueryOptions.queryKey;

  const { data, error, isLoading, isFetching, hasNextPage, fetchNextPage } =
    useInfiniteQuery(infiniteQueryOptions);

  const recipes = useMemo(() => {
    if (!data?.pages) return [];

    return data.pages.flatMap((page) => page.recipes);
  }, [data?.pages]);

  const total = data?.pages?.[0]?.total ?? 0;
  const hasMore = hasNextPage ?? false;

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      fetchNextPage();
    }
  }, [hasMore, isFetching, fetchNextPage]);

  const addPendingRecipe = useCallback(
    (recipeId: string) => {
      queryClient.setQueryData<string[]>(PENDING_RECIPES_KEY, (prev) => {
        const arr = prev ?? [];

        if (arr.includes(recipeId)) return arr;

        return [...arr, recipeId];
      });
    },
    [queryClient]
  );

  const removePendingRecipe = useCallback(
    (recipeId: string) => {
      queryClient.setQueryData<string[]>(PENDING_RECIPES_KEY, (prev) => {
        const arr = prev ?? [];

        return arr.filter((id) => id !== recipeId);
      });
    },
    [queryClient]
  );

  const setRecipesData = useCallback(
    (updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined) => {
      // Update only the current query (with current filters)
      queryClient.setQueryData<InfiniteRecipeData>(queryKey, updater);
    },
    [queryClient, queryKey]
  );

  const setAllRecipesData = useCallback(
    (updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined) => {
      // Update ALL recipe list queries (regardless of filters)
      // tRPC query keys are structured as [["procedure", "path"], { input, type }]
      const queries = queryClient.getQueriesData<InfiniteRecipeData>({
        queryKey: [["recipes", "list"]],
      });

      for (const [key] of queries) {
        queryClient.setQueryData<InfiniteRecipeData>(key, updater);
      }
    },
    [queryClient]
  );

  const invalidate = useCallback(() => {
    // Invalidate using a partial key match for all recipe lists
    queryClient.invalidateQueries({ queryKey: [["recipes", "list"]] });
  }, [queryClient]);

  return {
    recipes,
    total,
    isLoading,
    isValidating: isFetching,
    hasMore,
    error,
    queryKey,
    pendingRecipeIds,
    loadMore,
    addPendingRecipe,
    removePendingRecipe,
    setRecipesData,
    setAllRecipesData,
    invalidate,
  };
}
