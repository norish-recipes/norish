"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export function useFavoritesMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.favorites.list.queryKey();

  const toggleMutation = useMutation(
    trpc.favorites.toggle.mutationOptions({
      onMutate: async ({ recipeId }) => {
        await queryClient.cancelQueries({ queryKey });

        const previousData = queryClient.getQueryData<{ favoriteIds: string[] }>(queryKey);

        queryClient.setQueryData<{ favoriteIds: string[] }>(queryKey, (old) => {
          if (!old) return { favoriteIds: [recipeId] };

          const isFavorite = old.favoriteIds.includes(recipeId);

          return {
            favoriteIds: isFavorite
              ? old.favoriteIds.filter((id) => id !== recipeId)
              : [...old.favoriteIds, recipeId],
          };
        });

        return { previousData };
      },
      onError: (_err, _variables, context) => {
        if (context?.previousData) {
          queryClient.setQueryData(queryKey, context.previousData);
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    })
  );

  const toggleFavorite = (recipeId: string) => {
    toggleMutation.mutate({ recipeId });
  };

  return {
    toggleFavorite,
    isToggling: toggleMutation.isPending,
  };
}
