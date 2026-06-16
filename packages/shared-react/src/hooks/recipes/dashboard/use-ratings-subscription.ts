import type { InfiniteData } from "@tanstack/react-query";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../types";

type InfiniteRecipeData = InfiniteData<{
  recipes: RecipeDashboardDTO[];
  total: number;
  nextCursor: number | null;
}>;

export type RatingsSubscriptionCallbacks = {
  onRatingFailed?: (payload: { recipeId: string; reason: unknown }) => void;
};

export function createUseRatingsSubscription({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRatingsSubscription(callbacks: RatingsSubscriptionCallbacks = {}) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const recipesBaseKey = trpc.recipes.list.queryKey({});
    const recipesPath = useMemo(() => [recipesBaseKey[0]], [recipesBaseKey]);

    useSubscription(
      trpc.ratings.onRatingUpdated.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          const { recipeId, averageRating, ratingCount } = payload;
          const averageQueryKey = trpc.ratings.getAverage.queryKey({ recipeId });

          queryClient.setQueryData(averageQueryKey, { recipeId, averageRating, ratingCount });

          const userRatingQueryKey = trpc.ratings.getUserRating.queryKey({ recipeId });

          queryClient.invalidateQueries({ queryKey: userRatingQueryKey });

          queryClient.setQueriesData<InfiniteRecipeData>({ queryKey: recipesPath }, (old) => {
            if (!old?.pages) return old;

            return {
              ...old,
              pages: old.pages.map((page) => {
                const idx = page.recipes.findIndex((r) => r.id === recipeId);

                if (idx === -1) return page;

                const updatedRecipes = [...page.recipes];
                const recipe = updatedRecipes[idx];

                if (!recipe) {
                  return page;
                }

                updatedRecipes[idx] = {
                  ...recipe,
                  averageRating,
                  ratingCount,
                };

                return {
                  ...page,
                  recipes: updatedRecipes,
                };
              }),
            };
          });

          queryClient.invalidateQueries({ queryKey: recipesPath });
        },
      })
    );

    useSubscription(
      trpc.ratings.onRatingFailed.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          const { recipeId, reason } = payload;
          const userRatingQueryKey = trpc.ratings.getUserRating.queryKey({ recipeId });

          queryClient.invalidateQueries({ queryKey: userRatingQueryKey });

          callbacks.onRatingFailed?.({ recipeId, reason });
        },
      })
    );
  };
}
