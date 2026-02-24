"use client";

import { useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

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
    const queueEstimate = isEstimatingFromQueue as boolean | undefined;

    if (queueEstimate === true) {
      setIsEstimating(true);
    }
  }, [isEstimatingFromQueue]);

  return {
    isEstimating,
    setIsEstimating,
  };
}
