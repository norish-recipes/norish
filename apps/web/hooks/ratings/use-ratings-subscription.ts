"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useTranslations } from "next-intl";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";
import { showSafeErrorToast } from "@norish/shared/lib/ui/safe-error-toast";

type InfiniteRecipeData = InfiniteData<{
  recipes: RecipeDashboardDTO[];
  total: number;
  nextCursor: number | null;
}>;

export function useRatingsSubscription() {
  const trpc = useTRPC();
  const tErrors = useTranslations("common.errors");
  const queryClient = useQueryClient();

  // Get base key for partial matching - use empty params
  const recipesBaseKey = trpc.recipes.list.queryKey({});
  const recipesPath = useMemo(() => [recipesBaseKey[0]], [recipesBaseKey]);

  useSubscription(
    trpc.ratings.onRatingUpdated.subscriptionOptions(undefined, {
      onData: ({ recipeId, averageRating, ratingCount }: any) => {
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
      onData: ({ recipeId, reason }: any) => {
        const userRatingQueryKey = trpc.ratings.getUserRating.queryKey({ recipeId });

        queryClient.invalidateQueries({ queryKey: userRatingQueryKey });

        showSafeErrorToast({
          title: tErrors("operationFailed"),
          description: tErrors("technicalDetails"),
          error: reason,
          context: "ratings-subscription:onRatingFailed",
          metadata: { recipeId },
        });
      },
    })
  );
}
