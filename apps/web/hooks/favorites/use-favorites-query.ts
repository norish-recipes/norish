"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

export function useFavoritesQuery() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.favorites.list.queryKey();

  const query = useQuery(trpc.favorites.list.queryOptions());

  const favoriteIds = useMemo(() => query.data?.favoriteIds ?? [], [query.data?.favoriteIds]);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const isFavorite = useCallback(
    (recipeId: string): boolean => {
      return favoriteSet.has(recipeId);
    },
    [favoriteSet]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    favoriteIds,
    isFavorite,
    isLoading: query.isLoading,
    invalidate,
  };
}
