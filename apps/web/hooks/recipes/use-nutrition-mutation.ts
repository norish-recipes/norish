"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useMutation } from "@tanstack/react-query";

export function useNutritionMutation(recipeId: string) {
  const trpc = useTRPC();

  const estimateMutation = useMutation(trpc.recipes.estimateNutrition.mutationOptions());

  const estimateNutrition = () => {
    estimateMutation.mutate({ recipeId });
  };

  return {
    estimateNutrition,
  };
}
