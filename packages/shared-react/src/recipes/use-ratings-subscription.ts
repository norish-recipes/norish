"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RatingsRealtime } from "@norish/shared/contracts/realtime/ratings";

import type { InfiniteRecipeData } from "./library-cache";
import { usePlatform } from "../platform/platform";
import { useRealtimeSubscription } from "../realtime/use-realtime-subscription";
import { useTRPC } from "../trpc";

type Payload<E extends EventName<RatingsRealtime>> = PayloadOf<RatingsRealtime, E>;

/**
 * Ratings land where they are shown: the average and the dashboard rows are
 * patched in place, by recipe id, and nothing is refetched for an event the
 * cache already reflects. Only a lag refetches. A rating the server refused is toasted.
 */
export function useRatingsSubscription() {
  const { toast } = usePlatform();
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
    onEvent: ({ recipeId }) => {
      const userRatingQueryKey = trpc.ratings.getUserRating.queryKey({ recipeId });

      void queryClient.invalidateQueries({ queryKey: userRatingQueryKey });

      toast.show({
        severity: "danger",
        title: toast.translate("common.errors.operationFailed"),
        description: toast.translate("common.errors.technicalDetails"),
      });
    },
  });
}
