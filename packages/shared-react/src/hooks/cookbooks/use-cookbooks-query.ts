import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import type { CookbookFilters, CookbooksQueryResult, CreateCookbookHooksOptions } from "./types";

export function createUseCookbooksQuery({ useTRPC }: CreateCookbookHooksOptions) {
  return function useCookbooksQuery(
    filters: CookbookFilters = {},
    { enabled = true }: { enabled?: boolean } = {}
  ): CookbooksQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { limit = 50, search, sortMode = "dateDesc" } = filters;

    const infiniteQueryOptions = trpc.cookbooks.list.infiniteQueryOptions(
      { limit, search, sortMode },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );
    const queryKey = infiniteQueryOptions.queryKey;

    const { data, error, isLoading, isFetching, hasNextPage, fetchNextPage } = useInfiniteQuery({
      ...infiniteQueryOptions,
      enabled,
    });

    const cookbooks = useMemo(
      () => data?.pages?.flatMap((page) => page.cookbooks) ?? [],
      [data?.pages]
    );
    const hasMore = hasNextPage ?? false;

    const loadMore = useCallback(() => {
      if (hasMore && !isFetching) {
        fetchNextPage();
      }
    }, [hasMore, isFetching, fetchNextPage]);

    const invalidate = useCallback(
      () => queryClient.invalidateQueries({ queryKey }),
      [queryClient, queryKey]
    );

    return {
      cookbooks,
      total: data?.pages?.[0]?.total ?? 0,
      isLoading,
      isValidating: isFetching,
      hasMore,
      error,
      queryKey,
      loadMore,
      invalidate,
    };
  };
}
