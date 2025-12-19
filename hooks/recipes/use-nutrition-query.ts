"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export function useNutritionQuery(recipeId: string) {
  const trpc = useTRPC();
  const [isEstimating, setIsEstimating] = useState(false);

   const { data: isEstimatingFromQueue } = useQuery({
    ...trpc.recipes.isNutritionEstimating.queryOptions({ recipeId }),
    staleTime: 5000,
    refetchOnMount: true,
  });

  // Hydrate state from queue
  useEffect(() => {
    if (isEstimatingFromQueue === true) {
      setIsEstimating(true);
    }
  }, [isEstimatingFromQueue]);

  return {
    isEstimating,
    setIsEstimating,
  };
}
