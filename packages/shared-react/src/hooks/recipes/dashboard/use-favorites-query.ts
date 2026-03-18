import type { CreateRecipeHooksOptions } from "../types";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";


export type FavoritesQueryResult = {
  favoriteIds: string[];
  isFavorite: (recipeId: string) => boolean;
  isLoading: boolean;
  invalidate: () => void;
};

export function createUseFavoritesQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useFavoritesQuery(): FavoritesQueryResult {
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
  };
}
