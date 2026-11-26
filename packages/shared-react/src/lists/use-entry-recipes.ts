"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { byNextCursor } from "@norish/shared/contracts/list-queries";

import type { PickerKind } from "./entry-matching";
import { useTRPC } from "../trpc";

/** The household's recipes that carry one entry, by name, a page at a time: what "Used by" opens. */
export function useEntryRecipes(kind: PickerKind, id: string) {
  const trpc = useTRPC();
  const { data, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(trpc.lists.uses.infiniteQueryOptions({ kind, id }, byNextCursor));

  return {
    recipes: data?.pages.flatMap((page) => page.recipes) ?? [],
    loaded: data !== undefined,
    failed: isError && data === undefined,
    retry: () => void refetch(),
    hasMore: hasNextPage,
    loadingMore: isFetchingNextPage,
    loadMore: () => void fetchNextPage(),
  };
}
