import type { QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PublicRecipeViewDTO } from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../types";

export type SharedRecipeQueryResult = {
  recipe: PublicRecipeViewDTO | null;
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  invalidate: () => void;
};

export function createUseSharedRecipeQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useSharedRecipeQuery(token: string | null): SharedRecipeQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.recipes.getShared.queryKey({ token: token ?? "" });
    const query = useQuery({
      ...trpc.recipes.getShared.queryOptions({ token: token ?? "" }),
      enabled: !!token,
    });

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    return {
      recipe: query.data ?? null,
      isLoading: query.isLoading,
      error: query.error,
      queryKey,
      invalidate,
    };
  };
}
