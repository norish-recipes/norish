"use client";

import type { QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AdminRecipeShareInventoryDto,
  RecipeShareInventoryDto,
  RecipeShareSummaryDto,
} from "@norish/shared/contracts/dto/recipe-shares";

import type { ReadStatus } from "../trpc/read-status";
import { useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { readStatus, rereadAfterWrite } from "../trpc/read-status";

type RecipeSharesQueryResult = {
  shares: RecipeShareSummaryDto[];
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  setSharesData: (
    updater: (prev: RecipeShareSummaryDto[] | undefined) => RecipeShareSummaryDto[] | undefined
  ) => void;
  invalidate: () => void;
};

type ShareInventoryQueryResult<TShare> = ReadStatus & {
  shares: TShare[];
  queryKey: QueryKey;
  invalidate: () => void;
};

type MyRecipeSharesQueryResult = ShareInventoryQueryResult<RecipeShareInventoryDto>;
type AdminRecipeSharesQueryResult = ShareInventoryQueryResult<AdminRecipeShareInventoryDto>;

export function useRecipeSharesQuery(recipeId: string | null): RecipeSharesQueryResult {
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
}

export function useMyRecipeSharesQuery(): MyRecipeSharesQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.recipes.shareListMine.queryKey();
  const query = useQuery(trpc.recipes.shareListMine.queryOptions());

  // Told on the maker's own channel, so a link the maker may no longer view still rereads.
  useRealtimeSubscription(trpc.recipes.onMyShareEvent, {
    onEvent: () => void rereadAfterWrite(queryClient, queryKey),
    liveQueryKeys: [queryKey],
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    shares: query.data ?? [],
    ...readStatus(query),
    queryKey,
    invalidate,
  };
}

export function useAdminRecipeSharesQuery(): AdminRecipeSharesQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.recipes.shareListAdmin.queryKey();
  const query = useQuery(trpc.recipes.shareListAdmin.queryOptions());

  return {
    shares: query.data ?? [],
    ...readStatus(query),
    queryKey,
    invalidate: () => void queryClient.invalidateQueries({ queryKey }),
  };
}
