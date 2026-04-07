import type { QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AdminRecipeShareInventoryDto,
  RecipeShareInventoryDto,
  RecipeShareSummaryDto,
} from "@norish/shared/contracts/dto/recipe-shares";

import type { CreateRecipeHooksOptions } from "../types";

export type RecipeSharesQueryResult = {
  shares: RecipeShareSummaryDto[];
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  setSharesData: (
    updater: (prev: RecipeShareSummaryDto[] | undefined) => RecipeShareSummaryDto[] | undefined
  ) => void;
  invalidate: () => void;
};

type ShareInventoryQueryResult<TShare> = {
  shares: TShare[];
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  invalidate: () => void;
};

export type MyRecipeSharesQueryResult = ShareInventoryQueryResult<RecipeShareInventoryDto>;
export type AdminRecipeSharesQueryResult = ShareInventoryQueryResult<AdminRecipeShareInventoryDto>;

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
        updater: (prev: RecipeShareSummaryDto[] | undefined) => RecipeShareSummaryDto[] | undefined
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

export function createUseMyRecipeSharesQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useMyRecipeSharesQuery(): MyRecipeSharesQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.recipes.shareListMine.queryKey();
    const query = useQuery(trpc.recipes.shareListMine.queryOptions());

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    return {
      shares: query.data ?? [],
      isLoading: query.isLoading,
      error: query.error,
      queryKey,
      invalidate,
    };
  };
}

export function createUseAdminRecipeSharesQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useAdminRecipeSharesQuery(): AdminRecipeSharesQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.recipes.shareListAdmin.queryKey();
    const query = useQuery(trpc.recipes.shareListAdmin.queryOptions());

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    return {
      shares: query.data ?? [],
      isLoading: query.isLoading,
      error: query.error,
      queryKey,
      invalidate,
    };
  };
}
