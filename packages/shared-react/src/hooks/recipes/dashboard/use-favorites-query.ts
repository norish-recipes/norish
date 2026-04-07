import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../types";

export type FavoritesQueryResult = {
  favoriteIds: string[];
  favoriteVersions: Record<string, number>;
  isFavorite: (recipeId: string) => boolean;
  getFavoriteVersion: (recipeId: string) => number | undefined;
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
    const favoriteVersions = useMemo(
      () => query.data?.favoriteVersions ?? {},
      [query.data?.favoriteVersions]
    );
    const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

    const isFavorite = useCallback(
      (recipeId: string): boolean => {
        return favoriteSet.has(recipeId);
      },
      [favoriteSet]
    );

    const getFavoriteVersion = useCallback(
      (recipeId: string): number | undefined => favoriteVersions[recipeId],
      [favoriteVersions]
    );

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    return {
      favoriteIds,
      favoriteVersions,
      isFavorite,
      getFavoriteVersion,
      isLoading: query.isLoading,
      invalidate,
    };
  };
}
