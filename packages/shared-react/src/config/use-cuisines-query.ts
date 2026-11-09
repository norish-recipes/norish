import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/** The deployment's Cuisine vocabulary: the editor, the admin screen and AI read the same rows. */
export function useCuisinesQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.cuisines.queryOptions(),
    staleTime: 60 * 60 * 1000,
  });

  return {
    cuisines: data?.cuisines ?? [],
    error,
    isLoading,
  };
}
