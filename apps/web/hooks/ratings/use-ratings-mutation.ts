"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

type UserRatingData = { recipeId: string; userRating: number | null };

export function useRatingsMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const rateMutation = useMutation(
    trpc.ratings.rate.mutationOptions({
      onMutate: async ({ recipeId, rating }) => {
        const userRatingQueryKey = trpc.ratings.getUserRating.queryKey({ recipeId });

        await queryClient.cancelQueries({ queryKey: userRatingQueryKey });

        const previousUserRating = queryClient.getQueryData<UserRatingData>(userRatingQueryKey);

        queryClient.setQueryData<UserRatingData>(userRatingQueryKey, {
          recipeId,
          userRating: rating,
        });

        return { previousUserRating, userRatingQueryKey };
      },
    })
  );

  return {
    rateRecipe: (recipeId: string, rating: number) => rateMutation.mutate({ recipeId, rating }),
    isRating: rateMutation.isPending,
  };
}
