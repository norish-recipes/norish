import { useQuery } from "@tanstack/react-query";

import type { CreateConfigHooksOptions } from "./types";

/**
 * The ingredient words names are read by (ADR-0037), as the server has them:
 * the browser matches text nothing has resolved yet by them, as the resolver
 * does. Until they arrive, Norish's own words stand in.
 */
export function createUseIngredientWordsQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useIngredientWordsQuery() {
    const trpc = useTRPC();

    const { data, error, isLoading } = useQuery({
      ...trpc.config.ingredientWords.queryOptions(),
      staleTime: 60 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

    return {
      words: data,
      isLoading,
      error,
    };
  };
}
