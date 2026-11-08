import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/**
 * The deployment's Cuisine vocabulary.
 *
 * One list for everyone: an editor's picker and the administration screen read
 * the same rows AI is offered, so a manual entry and an inferred one land on the
 * same Cuisine.
 */
export function useCuisinesQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.cuisines.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  return {
    cuisines: data?.cuisines ?? [],
    error,
    isLoading,
  };
}
