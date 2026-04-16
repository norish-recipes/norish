import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CreateRatingsHooksOptions } from "./types";
import { shouldPreserveOptimisticUpdate as preserveOptimisticUpdate } from "../optimistic-updates";

type UserRatingData = { recipeId: string; userRating: number | null; version: number | null };

function getOptimisticRatingVersion(version: number | null): number | null {
  if (version == null) {
    return version;
  }

  return version + 1;
}

export function createUseRatingsMutation({
  useTRPC,
  shouldPreserveOptimisticUpdate,
}: CreateRatingsHooksOptions) {
  return function useRatingsMutation() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const rateMutation = useMutation(
      trpc.ratings.rate.mutationOptions({
        onMutate: async ({ recipeId, rating }) => {
          const userRatingQueryKey = trpc.ratings.getUserRating.queryKey({ recipeId });
          const averageRatingQueryKey = trpc.ratings.getAverage.queryKey({ recipeId });

          await queryClient.cancelQueries({ queryKey: userRatingQueryKey });
          await queryClient.cancelQueries({ queryKey: averageRatingQueryKey });

          const previousUserRating = queryClient.getQueryData<UserRatingData>(userRatingQueryKey);

          queryClient.setQueryData<UserRatingData>(userRatingQueryKey, {
            recipeId,
            userRating: rating,
            version: getOptimisticRatingVersion(previousUserRating?.version ?? null),
          });

          return { previousUserRating, userRatingQueryKey, averageRatingQueryKey };
        },
        onError: (error, _variables, context) => {
          if (preserveOptimisticUpdate(error, shouldPreserveOptimisticUpdate)) {
            return;
          }

          if (context?.previousUserRating) {
            queryClient.setQueryData(context.userRatingQueryKey, context.previousUserRating);
          }
        },
        onSettled: (_data, error, variables, context) => {
          if (error && preserveOptimisticUpdate(error, shouldPreserveOptimisticUpdate)) {
            return;
          }

          if (!error) {
            return;
          }

          if (context?.userRatingQueryKey) {
            queryClient.invalidateQueries({ queryKey: context.userRatingQueryKey });
          }

          if (context?.averageRatingQueryKey) {
            queryClient.invalidateQueries({ queryKey: context.averageRatingQueryKey });

            return;
          }

          queryClient.invalidateQueries({
            queryKey: trpc.ratings.getAverage.queryKey({ recipeId: variables.recipeId }),
          });
        },
      })
    );

    return {
      rateRecipe: (recipeId: string, rating: number) => {
        const userRatingQueryKey = trpc.ratings.getUserRating.queryKey({ recipeId });
        const previousUserRating = queryClient.getQueryData<UserRatingData>(userRatingQueryKey);

        rateMutation.mutate({
          recipeId,
          rating,
          version: previousUserRating?.version ?? undefined,
        });
      },
      isRating: rateMutation.isPending,
    };
  };
}
