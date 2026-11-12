"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { RecipeCategory } from "@norish/shared/contracts";

import { useTRPC } from "../trpc";

type RandomRecipeResult = {
  id: string;
  name: string;
  image: string | null;
} | null;

export function useRandomRecipe() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const getRandomRecipe = useCallback(
    async (category?: RecipeCategory): Promise<RandomRecipeResult> => {
      return queryClient.query({
        ...trpc.recipes.getRandomRecipe.queryOptions({ category }),
        staleTime: 0,
        gcTime: 0,
      });
    },
    [queryClient, trpc.recipes.getRandomRecipe]
  );

  return { getRandomRecipe };
}
