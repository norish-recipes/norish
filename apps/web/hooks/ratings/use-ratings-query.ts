"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

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
