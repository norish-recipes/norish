"use client";

import { useQueryClient } from "@tanstack/react-query";

import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RatingsRealtime } from "@norish/shared/contracts/realtime/ratings";

import { usePlatform } from "../platform/platform";
import { useRealtimeSubscription } from "../realtime/use-realtime-subscription";
import { useTRPC } from "../trpc";
import { useRecipesCacheHelpers } from "./use-recipes-cache";

type Payload<E extends EventName<RatingsRealtime>> = PayloadOf<RatingsRealtime, E>;

/**
 * Ratings land where they are shown: the average and the list and Library rows are
 * patched in place, by recipe id, and nothing is refetched for an event the
 * cache already reflects. Only a fresh subscription rereads. A rating the server refused is toasted.
 */
export function useRatingsSubscription() {
  const { toast } = usePlatform();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { setAllRecipesData } = useRecipesCacheHelpers();

  const liveQueryKeys = [
    trpc.ratings.getAverage.queryKey(),
    trpc.ratings.getUserRating.queryKey(),
    trpc.recipes.list.pathKey(),
    trpc.library.list.pathKey(),
  ];

  useRealtimeSubscription<Payload<"ratingUpdated">>(trpc.ratings.onRatingUpdated, {
    liveQueryKeys,
    onEvent: ({ recipeId, averageRating, ratingCount }) => {
      const averageQueryKey = trpc.ratings.getAverage.queryKey({ recipeId });

      queryClient.setQueryData(averageQueryKey, { recipeId, averageRating, ratingCount });

      const userRatingQueryKey = trpc.ratings.getUserRating.queryKey({ recipeId });

      void queryClient.invalidateQueries({ queryKey: userRatingQueryKey });

      setAllRecipesData((old) =>
        old?.pages
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                recipes: page.recipes.map((recipe) =>
                  recipe.id === recipeId ? { ...recipe, averageRating, ratingCount } : recipe
                ),
              })),
            }
          : old
      );
    },
  });

  useRealtimeSubscription<Payload<"ratingFailed">>(trpc.ratings.onRatingFailed, {
    liveQueryKeys,
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
