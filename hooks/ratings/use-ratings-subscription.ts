"use client";

import type { InfiniteData } from "@tanstack/react-query";
import type { RecipeDashboardDTO } from "@/types";

import { useSubscription } from "@trpc/tanstack-react-query";
import { useQueryClient } from "@tanstack/react-query";
import { addToast } from "@heroui/react";
import { useMemo } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

type InfiniteRecipeData = InfiniteData<{
  recipes: RecipeDashboardDTO[];
  total: number;
  nextCursor: number | null;
}>;

export function useRatingsSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get base key for partial matching - use empty params
  const recipesBaseKey = trpc.recipes.list.queryKey({});
  const recipesPath = useMemo(() => [recipesBaseKey[0]], [recipesBaseKey]);

  useSubscription(
    trpc.ratings.onRatingUpdated.subscriptionOptions(undefined, {
      onData: ({ recipeId, averageRating, ratingCount }) => {
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

              return {
                ...page,
                recipes: page.recipes.with(idx, {
                  ...page.recipes[idx],
                  averageRating,
                  ratingCount,
                }),
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
      onData: ({ recipeId, reason }) => {
        const userRatingQueryKey = trpc.ratings.getUserRating.queryKey({ recipeId });

        queryClient.invalidateQueries({ queryKey: userRatingQueryKey });

        addToast({
          severity: "danger",
          title: "Failed to rate recipe",
          description: reason,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
      },
    })
  );
}
