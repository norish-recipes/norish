"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

export function useRatingQuery(recipeId: string) {
  const trpc = useTRPC();

  const averageQuery = useQuery(trpc.ratings.getAverage.queryOptions({ recipeId }));
  const userRatingQuery = useQuery(trpc.ratings.getUserRating.queryOptions({ recipeId }));

  return {
    averageRating: averageQuery.data?.averageRating ?? null,
    ratingCount: averageQuery.data?.ratingCount ?? 0,
    userRating: userRatingQuery.data?.userRating ?? null,
    isLoading: averageQuery.isLoading || userRatingQuery.isLoading,
  };
}
