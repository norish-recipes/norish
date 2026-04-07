import { useQuery } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseRecipeAutocomplete({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRecipeAutocomplete(query: string, enabled: boolean) {
    const trpc = useTRPC();

    const { data: suggestions, isLoading } = useQuery({
      ...trpc.recipes.autocomplete.queryOptions({ query }),
      enabled: enabled && query.length >= 1,
      staleTime: 30000,
    });

    return { suggestions: suggestions ?? [], isLoading };
  };
}
