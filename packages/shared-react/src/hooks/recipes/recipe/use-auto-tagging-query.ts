import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseAutoTaggingQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useAutoTaggingQuery() {
    const trpc = useTRPC();

    const { data, isLoading, error } = useQuery({
      ...trpc.recipes.getPendingAutoTagging.queryOptions(),
      staleTime: 30_000,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    });

    const autoTaggingRecipeIds = useMemo(() => {
      const ids = Array.isArray(data) ? data : [];

      return new Set<string>(ids as string[]);
    }, [data]);

    return {
      autoTaggingRecipeIds,
      isLoading,
      error,
    };
  };
}
