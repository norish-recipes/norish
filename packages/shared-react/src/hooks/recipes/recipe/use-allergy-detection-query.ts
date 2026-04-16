import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseAllergyDetectionQuery({ useTRPC }: CreateRecipeHooksOptions) {
  return function useAllergyDetectionQuery() {
    const trpc = useTRPC();

    const { data, isLoading, error } = useQuery({
      ...trpc.recipes.getPendingAllergyDetection.queryOptions(),
      staleTime: 30_000,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    });

    const allergyDetectionRecipeIds = useMemo(() => {
      const ids = Array.isArray(data) ? data : [];

      return new Set<string>(ids as string[]);
    }, [data]);

    return {
      allergyDetectionRecipeIds,
      isLoading,
      error,
    };
  };
}
