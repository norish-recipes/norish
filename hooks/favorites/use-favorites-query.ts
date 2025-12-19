"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export function useFavoritesQuery() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery(trpc.favorites.list.queryOptions());

  const favoriteIds = query.data?.favoriteIds ?? [];

  const isFavorite = (recipeId: string): boolean => {
    return favoriteIds.includes(recipeId);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["favorites", "list"]] });
  };

  return {
    favoriteIds,
    isFavorite,
    isLoading: query.isLoading,
    invalidate,
  };
}
