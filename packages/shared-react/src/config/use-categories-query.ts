import { useQuery } from "@tanstack/react-query";

import { BUILT_IN_CATEGORIES } from "@norish/shared/lib/categories";

import { useTRPC } from "../trpc";

/** The household's Categories (built-ins first) and the aliases for `resolveCategoryName` (ADR-0040). */
export function useCategoriesQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.categories.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  return {
    categories: data?.categories ?? [...BUILT_IN_CATEGORIES],
    builtInAliases: data?.builtInAliases ?? {},
    error,
    isLoading,
  };
}
