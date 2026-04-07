import { useMutation } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseNutritionMutation({ useTRPC }: CreateRecipeHooksOptions) {
  return function useNutritionMutation(recipeId: string) {
    const trpc = useTRPC();

    const estimateMutation = useMutation(trpc.recipes.estimateNutrition.mutationOptions());

    const estimateNutrition = () => {
      estimateMutation.mutate({ recipeId });
    };

    return {
      estimateNutrition,
    };
  };
}
