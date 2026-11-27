"use client";

import type { QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import { useConnectivity } from "../offline/react/connectivity";
import { useTRPC } from "../trpc";
import { isNotFoundError } from "../trpc/not-found";

/** What a recipe page shows for its read: the recipe, a skeleton while it is read, not found,
 * offline with none held, or the failed read with Retry. */
export type RecipeReadState = "ready" | "loading" | "not-found" | "offline" | "failed";

export function recipeReadState(read: {
  recipe: FullRecipeDTO | null;
  error: unknown;
  isFetching: boolean;
  isOffline: boolean;
}): RecipeReadState {
  if (read.recipe) return "ready";
  if (isNotFoundError(read.error)) return "not-found";
  if (read.isOffline) return "offline";

  return read.error && !read.isFetching ? "failed" : "loading";
}

type RecipeQueryResult = {
  recipe: FullRecipeDTO | null;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  queryKey: QueryKey;
  state: RecipeReadState;
  /** Reads the recipe again, after a failed read. */
  retry: () => void;
  setRecipeData: (
    updater: (prev: FullRecipeDTO | null | undefined) => FullRecipeDTO | null | undefined
  ) => void;
  invalidate: () => void;
};

export function useRecipeQuery(id: string | null): RecipeQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isOffline } = useConnectivity();

  const queryKey = trpc.recipes.get.queryKey({ id: id ?? "" });

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    ...trpc.recipes.get.queryOptions({ id: id ?? "" }),
    enabled: !!id,
  });

  const setRecipeData = useCallback(
    (updater: (prev: FullRecipeDTO | null | undefined) => FullRecipeDTO | null | undefined) => {
      queryClient.setQueryData<FullRecipeDTO | null>(queryKey, updater);
    },
    [queryClient, queryKey]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    recipe: data ?? null,
    isLoading,
    isFetching,
    error,
    queryKey,
    state: recipeReadState({ recipe: data ?? null, error, isFetching, isOffline }),
    retry: () => void refetch(),
    setRecipeData,
    invalidate,
  };
}
