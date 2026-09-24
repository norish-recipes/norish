import type { InfiniteData } from "@tanstack/react-query";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RatingsRealtime } from "@norish/shared/contracts/realtime/ratings";

import type { CreateRecipeHooksOptions } from "../types";
import { useRealtimeSubscription } from "../../../realtime/use-realtime-subscription";

type Payload<E extends EventName<RatingsRealtime>> = PayloadOf<RatingsRealtime, E>;

type InfiniteRecipeData = InfiniteData<{
  recipes: RecipeDashboardDTO[];
  total: number;
  nextCursor: number | null;
}>;

export type RatingsSubscriptionCallbacks = {
  onRatingFailed?: (payload: Payload<"ratingFailed">) => void;
};

/**
 * Ratings land where they are shown: the average and the dashboard rows are
 * patched in place, by recipe id, and nothing is refetched for an event the
 * cache already reflects. Only a lag refetches.
 */
export function createUseRatingsSubscription({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRatingsSubscription(callbacks: RatingsSubscriptionCallbacks = {}) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const recipesBaseKey = trpc.recipes.list.queryKey({});
    const recipesPath = useMemo(() => [recipesBaseKey[0]], [recipesBaseKey]);

    const lagQueryKeys = [
      trpc.ratings.getAverage.queryKey(),
      trpc.ratings.getUserRating.queryKey(),
      recipesPath,
    ];

    useRealtimeSubscription<Payload<"ratingUpdated">>(trpc.ratings.onRatingUpdated, {
      lagQueryKeys,
      onEvent: ({ recipeId, averageRating, ratingCount }) => {
        const averageQueryKey = trpc.ratings.getAverage.queryKey({ recipeId });

        queryClient.setQueryData(averageQueryKey, { recipeId, averageRating, ratingCount });

        const userRatingQueryKey = trpc.ratings.getUserRating.queryKey({ recipeId });

        void queryClient.invalidateQueries({ queryKey: userRatingQueryKey });

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
      },
    });

    useRealtimeSubscription<Payload<"ratingFailed">>(trpc.ratings.onRatingFailed, {
      lagQueryKeys,
      onEvent: (payload) => {
        const userRatingQueryKey = trpc.ratings.getUserRating.queryKey({
          recipeId: payload.recipeId,
        });

        void queryClient.invalidateQueries({ queryKey: userRatingQueryKey });

        callbacks.onRatingFailed?.(payload);
      },
    });
  };
}
