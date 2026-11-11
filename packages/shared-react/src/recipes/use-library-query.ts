"use client";

import type { QueryKey } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import type { LibraryItemDTO, LibraryTypeFilter } from "@norish/shared/contracts";
import { byNextCursor, libraryListInput } from "@norish/shared/contracts/list-queries";

import type { RecipeFilters } from "./use-recipes-query";
import { useTRPC } from "../trpc";

export type LibraryFilters = RecipeFilters & {
  type?: LibraryTypeFilter;
  favoritesOnly?: boolean;
};

export type LibraryQueryResult = {
  items: LibraryItemDTO[];
  queryKey: QueryKey;
  /** Counts both kinds. Nothing may read this as a recipe count. */
  total: number;
  isLoading: boolean;
  /** Any read of the list, the next page or a reread of the pages showing. */
  isFetching: boolean;
  /** Only the next page: a reread of pages already showing draws no indicator. */
  isFetchingNextPage: boolean;
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
export function useLibraryQuery(
  filters: LibraryFilters = {},
  { enabled = true }: { enabled?: boolean } = {}
): LibraryQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const infiniteQueryOptions = trpc.library.list.infiniteQueryOptions(
    libraryListInput(filters),
    byNextCursor
  );
  const queryKey = infiniteQueryOptions.queryKey;

  const { data, error, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      ...infiniteQueryOptions,
      enabled,
    });

  const items = useMemo(() => data?.pages?.flatMap((page) => page.items) ?? [], [data?.pages]);
  const hasMore = hasNextPage ?? false;

  return {
    items,
    queryKey,
    total: data?.pages?.[0]?.total ?? 0,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasMore,
    error,
    loadMore: useCallback(() => {
      if (hasMore && !isFetching) fetchNextPage();
    }, [hasMore, isFetching, fetchNextPage]),
    invalidate: useCallback(() => {
      void queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]),
  };
}
