"use client";

/**
 * Lightweight cache manipulation helpers for recipes.
 *
 * This hook provides functions to update the React Query cache WITHOUT
 * creating query observers. Use this in subscription hooks to avoid
 * duplicate hook trees that cause recursion issues.
 *
 * For reading data + cache manipulation, use useRecipesQuery instead.
 */

import type { RecipeDashboardDTO, PendingRecipeDTO } from "@/types";
import type { InfiniteData } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

export type InfiniteRecipeData = InfiniteData<{
  recipes: RecipeDashboardDTO[];
  total: number;
  nextCursor: number | null;
}>;

export type RecipesCacheHelpers = {
  setAllRecipesData: (
    updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined
  ) => void;
  invalidate: () => void;
  addPendingRecipe: (id: string) => void;
  removePendingRecipe: (id: string) => void;
  addAutoTaggingRecipe: (id: string) => void;
  removeAutoTaggingRecipe: (id: string) => void;
  addAllergyDetectionRecipe: (id: string) => void;
  removeAllergyDetectionRecipe: (id: string) => void;
};

/**
 * Returns cache manipulation helpers without creating query observers.
 * Safe to call from subscription hooks - won't cause recursion.
 *
 * Mutates the tRPC query cache directly - no separate local keys needed.
 */
export function useRecipesCacheHelpers(): RecipesCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get base key for partial matching - use empty params
  const recipesBaseKey = trpc.recipes.list.queryKey({});

  // Extract just the procedure path for partial matching
  const recipesPath = useMemo(() => [recipesBaseKey[0]], [recipesBaseKey]);

  // Get tRPC query keys for pending states
  const pendingKey = trpc.recipes.getPending.queryKey();
  const autoTaggingKey = trpc.recipes.getPendingAutoTagging.queryKey();
  const allergyDetectionKey = trpc.recipes.getPendingAllergyDetection.queryKey();

  const setAllRecipesData = useCallback(
    (updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined) => {
      // Update ALL recipe list queries (regardless of filters)
      const queries = queryClient.getQueriesData<InfiniteRecipeData>({
        queryKey: recipesPath,
      });

      for (const [key] of queries) {
        queryClient.setQueryData<InfiniteRecipeData>(key, updater);
      }
    },
    [queryClient, recipesPath]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: recipesPath });
  }, [queryClient, recipesPath]);

  // getPending returns PendingRecipeDTO[] - we add/remove from this array
  const addPendingRecipe = useCallback(
    (recipeId: string) => {
      queryClient.setQueryData<PendingRecipeDTO[]>(pendingKey, (prev) => {
        const arr = prev ?? [];

        if (arr.some((p) => p.recipeId === recipeId)) return arr;

        // Add with minimal info - the skeleton just needs the ID
        return [...arr, { recipeId, url: "", addedAt: Date.now() }];
      });
    },
    [queryClient, pendingKey]
  );

  const removePendingRecipe = useCallback(
    (recipeId: string) => {
      queryClient.setQueryData<PendingRecipeDTO[]>(pendingKey, (prev) => {
        const arr = prev ?? [];

        return arr.filter((p) => p.recipeId !== recipeId);
      });
    },
    [queryClient, pendingKey]
  );

  // getPendingAutoTagging returns string[] - mutate directly
  const addAutoTaggingRecipe = useCallback(
    (recipeId: string) => {
      queryClient.setQueryData<string[]>(autoTaggingKey, (prev) => {
        const arr = prev ?? [];

        if (arr.includes(recipeId)) return arr;

        return [...arr, recipeId];
      });
    },
    [queryClient, autoTaggingKey]
  );

  const removeAutoTaggingRecipe = useCallback(
    (recipeId: string) => {
      queryClient.setQueryData<string[]>(autoTaggingKey, (prev) => {
        const arr = prev ?? [];

        return arr.filter((id) => id !== recipeId);
      });
    },
    [queryClient, autoTaggingKey]
  );

  // getPendingAllergyDetection returns string[] - mutate directly
  const addAllergyDetectionRecipe = useCallback(
    (recipeId: string) => {
      queryClient.setQueryData<string[]>(allergyDetectionKey, (prev) => {
        const arr = prev ?? [];

        if (arr.includes(recipeId)) return arr;

        return [...arr, recipeId];
      });
    },
    [queryClient, allergyDetectionKey]
  );

  const removeAllergyDetectionRecipe = useCallback(
    (recipeId: string) => {
      queryClient.setQueryData<string[]>(allergyDetectionKey, (prev) => {
        const arr = prev ?? [];

        return arr.filter((id) => id !== recipeId);
      });
    },
    [queryClient, allergyDetectionKey]
  );

  return {
    setAllRecipesData,
    invalidate,
    addPendingRecipe,
    removePendingRecipe,
    addAutoTaggingRecipe,
    removeAutoTaggingRecipe,
    addAllergyDetectionRecipe,
    removeAllergyDetectionRecipe,
  };
}
