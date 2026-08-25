import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import type { LibraryItemDTO, LibraryTypeFilter } from "@norish/shared/contracts";

import type { RecipeFilters } from "../recipes/dashboard";
import type { CreateRecipeHooksOptions } from "../recipes/types";

export type LibraryFilters = RecipeFilters & {
  type?: LibraryTypeFilter;
  favoritesOnly?: boolean;
};

export type LibraryQueryResult = {
  items: LibraryItemDTO[];
  /** Counts both kinds. Nothing may read this as a recipe count. */
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  hasMore: boolean;
  error: unknown;
  loadMore: () => void;
  invalidate: () => void;
};

/**
 * The Library: one interleaved, paginated list over both kinds.
 *
 * A separate query from `recipes.list`, which every existing caller keeps
 * using unchanged — the mobile app included (ADR-0026).
 */
export function createUseLibraryQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useLibraryQuery(
    filters: LibraryFilters = {},
    { enabled = true }: { enabled?: boolean } = {}
  ): LibraryQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const {
      // The same default the recipe list uses, so the Warm Set's guaranteed
      // floor and the reader's own first page are one cache entry rather than
      // two (ADR-0009).
      limit = 100,
      search,
      searchFields,
      tags,
      categories,
      filterMode = "AND",
      sortMode = "dateDesc",
      minRating,
      maxCookingTime,
      favoritesOnly = false,
      type = "all",
    } = filters;

    const infiniteQueryOptions = trpc.library.list.infiniteQueryOptions(
      {
        limit,
        search,
        searchFields,
        tags,
        categories,
        filterMode,
        sortMode,
        minRating,
        maxCookingTime,
        favoritesOnly,
        type,
      },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );
    const queryKey = infiniteQueryOptions.queryKey;

    const { data, error, isLoading, isFetching, hasNextPage, fetchNextPage } = useInfiniteQuery({
      ...infiniteQueryOptions,
      enabled,
    });

    const items = useMemo(() => data?.pages?.flatMap((page) => page.items) ?? [], [data?.pages]);
    const hasMore = hasNextPage ?? false;

    return {
      items,
      total: data?.pages?.[0]?.total ?? 0,
      isLoading,
      isValidating: isFetching,
      hasMore,
      error,
      loadMore: useCallback(() => {
        if (hasMore && !isFetching) fetchNextPage();
      }, [hasMore, isFetching, fetchNextPage]),
      invalidate: useCallback(() => {
        void queryClient.invalidateQueries({ queryKey });
      }, [queryClient, queryKey]),
    };
  };
}
