"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { PendingRecipeDTO } from "@norish/shared/contracts";

import type { InfiniteLibraryData, InfiniteRecipeData } from "./library-cache";
import { useTRPC } from "../trpc";
import { applyRecipeUpdateToLibrary, applyRecipeUpdateToMembers } from "./library-cache";

export const OPTIMISTIC_PENDING_RECIPE_PREFIX = "optimistic-pending-recipe:";

function isOptimisticPendingRecipeId(recipeId: string): boolean {
  return recipeId.startsWith(OPTIMISTIC_PENDING_RECIPE_PREFIX);
}

export function removeRecipesFromLists(
  previousData: InfiniteRecipeData | undefined,
  recipeIds: ReadonlySet<string>
): InfiniteRecipeData | undefined {
  if (!previousData?.pages) {
    return previousData;
  }

  const removed = previousData.pages.reduce(
    (count, page) => count + page.recipes.filter((recipe) => recipeIds.has(recipe.id)).length,
    0
  );

  if (removed === 0) {
    return previousData;
  }

  return {
    ...previousData,
    pages: previousData.pages.map((page) => ({
      ...page,
      recipes: page.recipes.filter((recipe) => !recipeIds.has(recipe.id)),
      total: Math.max(page.total - removed, 0),
    })),
  };
}

type RecipesCacheHelpers = {
  setAllRecipesData: (
    updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined
  ) => void;
  invalidate: () => void;
  addPendingRecipe: (id: string, url?: string) => void;
  replacePendingRecipe: (fromId: string, toId: string) => void;
  replaceOldestOptimisticPendingRecipe: (recipeId: string, url?: string) => void;
  removePendingRecipe: (id: string) => void;
};

export function useRecipesCacheHelpers(): RecipesCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const pendingKey = trpc.recipes.getPending.queryKey();

  // The Library holds the same recipes in one interleaved list (ADR-0026), and a cookbook page
  // draws its members with the Library's card, so anything that reaches the recipe lists reaches both.
  const setAllRecipesData = useCallback(
    (updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined) => {
      for (const [key] of queryClient.getQueriesData<InfiniteRecipeData>({
        queryKey: trpc.recipes.list.pathKey(),
      })) {
        queryClient.setQueryData<InfiniteRecipeData>(key, updater);
      }

      for (const [key] of queryClient.getQueriesData<InfiniteLibraryData>({
        queryKey: trpc.library.list.pathKey(),
      })) {
        queryClient.setQueryData<InfiniteLibraryData>(key, (previous) =>
          applyRecipeUpdateToLibrary(previous, updater)
        );
      }

      for (const [key] of queryClient.getQueriesData<InfiniteRecipeData>({
        queryKey: trpc.cookbooks.recipes.pathKey(),
      })) {
        queryClient.setQueryData<InfiniteRecipeData>(key, (previous) =>
          applyRecipeUpdateToMembers(previous, updater)
        );
      }
    },
    [queryClient, trpc]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: trpc.recipes.list.pathKey() });
    queryClient.invalidateQueries({ queryKey: trpc.library.list.pathKey() });
    queryClient.invalidateQueries({ queryKey: trpc.cookbooks.recipes.pathKey() });
  }, [queryClient, trpc]);

  const addPendingRecipe = useCallback(
    (recipeId: string, url = "") => {
      queryClient.setQueryData<PendingRecipeDTO[]>(pendingKey, (prev) => {
        const arr = prev ?? [];

        if (arr.some((p) => p.recipeId === recipeId)) return arr;

        return [...arr, { recipeId, url, addedAt: Date.now() }];
      });
    },
    [queryClient, pendingKey]
  );

  const replacePendingRecipe = useCallback(
    (fromId: string, toId: string) => {
      queryClient.setQueryData<PendingRecipeDTO[]>(pendingKey, (prev) => {
        const arr = prev ?? [];

        if (fromId === toId) {
          return arr;
        }

        const next = arr.map((pending) =>
          pending.recipeId === fromId ? { ...pending, recipeId: toId } : pending
        );

        return next.filter(
          (pending, index) => next.findIndex((item) => item.recipeId === pending.recipeId) === index
        );
      });
    },
    [queryClient, pendingKey]
  );

  const replaceOldestOptimisticPendingRecipe = useCallback(
    (recipeId: string, url = "") => {
      queryClient.setQueryData<PendingRecipeDTO[]>(pendingKey, (prev) => {
        const arr = prev ?? [];
        const existing = arr.find((pending) => pending.recipeId === recipeId);

        // The import's own link arrives with its started event, after the placeholder.
        if (existing) {
          const learnsLink = !existing.url && url;

          if (!learnsLink) return arr;

          return arr.map((pending) => (pending === existing ? { ...pending, url } : pending));
        }

        const optimisticPending = arr.find((pending) =>
          isOptimisticPendingRecipeId(pending.recipeId)
        );

        if (!optimisticPending) {
          return [...arr, { recipeId, url, addedAt: Date.now() }];
        }

        return arr.map((pending) =>
          pending.recipeId === optimisticPending.recipeId ? { ...pending, recipeId, url } : pending
        );
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

  return {
    setAllRecipesData,
    invalidate,
    addPendingRecipe,
    replacePendingRecipe,
    replaceOldestOptimisticPendingRecipe,
    removePendingRecipe,
  };
}
