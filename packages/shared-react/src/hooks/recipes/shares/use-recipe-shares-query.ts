import type { QueryKey } from "@tanstack/react-query";
import type { RecipeShareSummaryDto } from "@norish/shared/contracts";
import type { CreateRecipeHooksOptions } from "../types";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type RecipeSharesQueryResult = {
  shares: RecipeShareSummaryDto[];
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  setSharesData: (
    updater: (
      prev: RecipeShareSummaryDto[] | undefined
    ) => RecipeShareSummaryDto[] | undefined
  ) => void;
  invalidate: () => void;
};

export function createUseRecipeSharesQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRecipeSharesQuery(recipeId: string | null): RecipeSharesQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.recipes.shareList.queryKey({ recipeId: recipeId ?? "" });
    const query = useQuery({
      ...trpc.recipes.shareList.queryOptions({ recipeId: recipeId ?? "" }),
      enabled: !!recipeId,
    });

    const setSharesData = useCallback(
      (
        updater: (
          prev: RecipeShareSummaryDto[] | undefined
        ) => RecipeShareSummaryDto[] | undefined
      ) => {
        queryClient.setQueryData<RecipeShareSummaryDto[]>(queryKey, updater);
      },
      [queryClient, queryKey]
    );

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    return {
      shares: query.data ?? [],
      isLoading: query.isLoading,
      error: query.error,
      queryKey,
      setSharesData,
      invalidate,
    };
  };
}
