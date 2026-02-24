"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

export function useRecipeAutocomplete(query: string, enabled: boolean) {
  const trpc = useTRPC();

  const { data: suggestions, isLoading } = useQuery({
    ...trpc.recipes.autocomplete.queryOptions({ query }),
    enabled: enabled && query.length >= 1,
    staleTime: 30000,
  });

  return { suggestions: suggestions ?? [], isLoading };
}
