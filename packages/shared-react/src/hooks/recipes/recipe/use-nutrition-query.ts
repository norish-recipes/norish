import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseNutritionQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useNutritionQuery(recipeId: string) {
    const trpc = useTRPC();
    const [isEstimating, setIsEstimating] = useState(false);

    const { data: isEstimatingFromQueue } = useQuery({
      ...trpc.recipes.isNutritionEstimating.queryOptions({ recipeId }),
      staleTime: 5000,
      refetchOnMount: true,
    });

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
  };
}
