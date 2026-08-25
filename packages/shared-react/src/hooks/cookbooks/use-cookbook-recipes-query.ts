import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";

import type { RecipeFilters } from "../recipes/dashboard";
import type { CreateCookbookHooksOptions } from "./types";

export type CookbookRecipesQueryResult = {
  recipes: RecipeDashboardDTO[];
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  hasMore: boolean;
  loadMore: () => void;
  invalidate: () => void;
};

/**
 * One cookbook's members, read through the recipe list itself, so the page
 * honours the reader's stored sort, search and filters and pages the same way
 * the Library does.
 */
export function createUseCookbookRecipesQuery({ useTRPC }: CreateCookbookHooksOptions) {
  return function useCookbookRecipesQuery(
    cookbookId: string,
    filters: RecipeFilters = {},
    { enabled = true }: { enabled?: boolean } = {}
  ): CookbookRecipesQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const {
      limit = 50,
      search,
      searchFields,
      tags,
      categories,
      filterMode = "AND",
      sortMode = "dateDesc",
      minRating,
      maxCookingTime,
    } = filters;

    const infiniteQueryOptions = trpc.cookbooks.recipes.infiniteQueryOptions(
      {
        cookbookId,
        limit,
        search,
        searchFields,
        tags,
        categories,
        filterMode,
        sortMode,
        minRating,
        maxCookingTime,
      },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );
    const queryKey = infiniteQueryOptions.queryKey;

    const { data, isLoading, isFetching, hasNextPage, fetchNextPage } = useInfiniteQuery({
      ...infiniteQueryOptions,
      enabled: enabled && Boolean(cookbookId),
    });

    const recipes = useMemo(
      () => data?.pages?.flatMap((page) => page.recipes) ?? [],
      [data?.pages]
    );
    const hasMore = hasNextPage ?? false;

    return {
      recipes,
      total: data?.pages?.[0]?.total ?? 0,
      isLoading,
      isValidating: isFetching,
      hasMore,
      loadMore: useCallback(() => {
        if (hasMore && !isFetching) fetchNextPage();
      }, [hasMore, isFetching, fetchNextPage]),
      invalidate: useCallback(() => {
        void queryClient.invalidateQueries({ queryKey });
      }, [queryClient, queryKey]),
    };
  };
}
