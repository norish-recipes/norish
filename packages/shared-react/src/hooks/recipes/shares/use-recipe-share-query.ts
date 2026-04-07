import type { QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { RecipeShareSummaryDto } from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../types";

export type RecipeShareQueryResult = {
  share: RecipeShareSummaryDto | null;
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  setShareData: (
    updater: (
      prev: RecipeShareSummaryDto | null | undefined
    ) => RecipeShareSummaryDto | null | undefined
  ) => void;
  invalidate: () => void;
};

export function createUseRecipeShareQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRecipeShareQuery(shareId: string | null): RecipeShareQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.recipes.shareGet.queryKey({ id: shareId ?? "" });
    const query = useQuery({
      ...trpc.recipes.shareGet.queryOptions({ id: shareId ?? "" }),
      enabled: !!shareId,
    });

    const setShareData = useCallback(
      (
        updater: (
          prev: RecipeShareSummaryDto | null | undefined
        ) => RecipeShareSummaryDto | null | undefined
      ) => {
        queryClient.setQueryData<RecipeShareSummaryDto | null>(queryKey, updater);
      },
      [queryClient, queryKey]
    );

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    return {
      share: query.data ?? null,
      isLoading: query.isLoading,
      error: query.error,
      queryKey,
      setShareData,
      invalidate,
    };
  };
}
