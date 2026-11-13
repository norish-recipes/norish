import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/**
 * The server's ingredient words (ADR-0037), which the browser matches unresolved text by as the
 * resolver does; Norish's own words stand in until they arrive.
 */
export function useIngredientWordsQuery() {
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
}
