"use client";

import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

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
