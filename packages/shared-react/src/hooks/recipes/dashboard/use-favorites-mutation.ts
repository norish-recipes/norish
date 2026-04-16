import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../types";
import { shouldPreserveOptimisticUpdate as preserveOptimisticUpdate } from "../../optimistic-updates";

export type FavoritesMutationResult = {
  toggleFavorite: (recipeId: string) => void;
  isToggling: boolean;
};

type FavoritesListData = {
  favoriteIds: string[];
  favoriteVersions: Record<string, number>;
};

export function createUseFavoritesMutation({
  useTRPC,
  shouldPreserveOptimisticUpdate,
}: CreateRecipeHooksOptions) {
  return function useFavoritesMutation(): FavoritesMutationResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.favorites.list.queryKey();

    const toggleMutation = useMutation(
      trpc.favorites.toggle.mutationOptions({
        onMutate: async ({ recipeId, isFavorite: desiredState }) => {
          await queryClient.cancelQueries({ queryKey });

          const previousData = queryClient.getQueryData<FavoritesListData>(queryKey);

          queryClient.setQueryData<FavoritesListData>(queryKey, (old) => {
            if (!old) {
              return desiredState
                ? { favoriteIds: [recipeId], favoriteVersions: {} }
                : { favoriteIds: [], favoriteVersions: {} };
            }

            return {
              favoriteIds: desiredState
                ? old.favoriteIds.includes(recipeId)
                  ? old.favoriteIds
                  : [...old.favoriteIds, recipeId]
                : old.favoriteIds.filter((id) => id !== recipeId),
              favoriteVersions: desiredState
                ? old.favoriteVersions
                : Object.fromEntries(
                    Object.entries(old.favoriteVersions).filter(([id]) => id !== recipeId)
                  ),
            };
          });

          return { previousData };
        },
        onError: (error, _variables, context) => {
          if (preserveOptimisticUpdate(error, shouldPreserveOptimisticUpdate)) {
            return;
          }

          if (context?.previousData) {
            queryClient.setQueryData(queryKey, context.previousData);
          }
        },
        onSettled: (_data, error) => {
          if (error && preserveOptimisticUpdate(error, shouldPreserveOptimisticUpdate)) {
            return;
          }

          queryClient.invalidateQueries({ queryKey });
        },
      })
    );

    const toggleFavorite = (recipeId: string) => {
      const favorites = queryClient.getQueryData<FavoritesListData>(queryKey);
      const isCurrentlyFavorite = favorites?.favoriteIds.includes(recipeId) ?? false;

      toggleMutation.mutate({
        recipeId,
        isFavorite: !isCurrentlyFavorite,
        version: favorites?.favoriteVersions[recipeId],
      });
    };

    return {
      toggleFavorite,
      isToggling: toggleMutation.isPending,
    };
  };
}
