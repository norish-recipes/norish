"use client";

import type { QueryKey } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { hashKey, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import type { LibraryItemDTO, LibraryTypeFilter } from "@norish/shared/contracts";
import { byNextCursor, libraryListInput } from "@norish/shared/contracts/list-queries";

import type { RecipeFilters } from "./use-recipes-query";
import { useConnectivity } from "../offline/react";
import { useTRPC } from "../trpc";

type LibraryFilters = RecipeFilters & {
  type?: LibraryTypeFilter;
  favoritesOnly?: boolean;
  sortBeatsRank?: boolean;
  withMatch?: boolean;
};

type LibraryQueryResult = {
  items: LibraryItemDTO[];
  queryKey: QueryKey;
  /** Counts both kinds. Nothing may read this as a recipe count. */
  total: number;
  isLoading: boolean;
  /** Some read of this exact list is held, loaded Live or from the Offline Cache (an empty one counts). */
  held: boolean;
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
  const { isOffline } = useConnectivity();
  const infiniteQueryOptions = trpc.library.list.infiniteQueryOptions(
    libraryListInput(filters),
    byNextCursor
  );
  const queryKey = infiniteQueryOptions.queryKey;

  const {
    data,
    dataUpdatedAt,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    ...infiniteQueryOptions,
    enabled,
  });

  const items = useMemo(() => data?.pages?.flatMap((page) => page.items) ?? [], [data?.pages]);
  const hasMore = hasNextPage ?? false;
  const queryHash = hashKey(queryKey);
  // The query and page count a loadMore was swallowed Offline for; it is asked again when Live
  // until a page lands, as Recovery's refetch can cancel the first ask.
  const swallowed = useRef<{ hash: string; pages: number } | null>(null);
  const pageCount = data?.pages?.length ?? 0;

  useEffect(() => {
    const asked = swallowed.current;

    if (asked === null || isOffline || isFetching || error) return;
    if (asked.hash !== queryHash || pageCount > asked.pages || !hasMore) {
      swallowed.current = null;

      return;
    }
    void fetchNextPage();
  }, [isOffline, isFetching, error, hasMore, queryHash, pageCount, dataUpdatedAt, fetchNextPage]);

  return {
    items,
    queryKey,
    total: data?.pages?.[0]?.total ?? 0,
    isLoading,
    held: data !== undefined,
    isFetching,
    isFetchingNextPage,
    hasMore,
    error,
    loadMore: useCallback(() => {
      // Offline no page is asked for and no spinner draws; the ask is remembered for Live.
      if (isOffline) swallowed.current = { hash: queryHash, pages: pageCount };
      else if (hasMore && !isFetching) fetchNextPage();
    }, [hasMore, isFetching, isOffline, queryHash, pageCount, fetchNextPage]),
    invalidate: useCallback(() => {
      void queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]),
  };
}
