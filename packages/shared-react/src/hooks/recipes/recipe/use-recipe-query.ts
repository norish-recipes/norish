import type { QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../types";

export type RecipeQueryResult = {
  recipe: FullRecipeDTO | null;
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  setRecipeData: (
    updater: (prev: FullRecipeDTO | null | undefined) => FullRecipeDTO | null | undefined
  ) => void;
  invalidate: () => void;
};

export function createUseRecipeQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRecipeQuery(id: string | null): RecipeQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const queryKey = trpc.recipes.get.queryKey({ id: id ?? "" });

    const { data, error, isLoading } = useQuery({
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
      error,
      queryKey,
      setRecipeData,
      invalidate,
    };
  };
}
