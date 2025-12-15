"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export function useFavoritesMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const toggleMutation = useMutation(
    trpc.favorites.toggle.mutationOptions({
      onMutate: async ({ recipeId }) => {
        await queryClient.cancelQueries({ queryKey: [["favorites", "list"]] });

        const previousData = queryClient.getQueryData<{ favoriteIds: string[] }>([
          ["favorites", "list"],
          { type: "query" },
        ]);

        queryClient.setQueryData<{ favoriteIds: string[] }>(
          [["favorites", "list"], { type: "query" }],
          (old) => {
            if (!old) return { favoriteIds: [recipeId] };

            const isFavorite = old.favoriteIds.includes(recipeId);

            return {
              favoriteIds: isFavorite
                ? old.favoriteIds.filter((id) => id !== recipeId)
                : [...old.favoriteIds, recipeId],
            };
          }
        );

        return { previousData };
      },
      onError: (_err, _variables, context) => {
        if (context?.previousData) {
          queryClient.setQueryData(
            [["favorites", "list"], { type: "query" }],
            context.previousData
          );
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: [["favorites", "list"]] });
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
