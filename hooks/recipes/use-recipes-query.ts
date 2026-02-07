"use client";

import type { RecipeCategory, RecipeDashboardDTO, SearchField } from "@/types";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

import { useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";

import { usePendingRecipesQuery } from "./use-pending-recipes-query";
import { useAutoTaggingQuery } from "./use-auto-tagging-query";
import { useAllergyDetectionQuery } from "./use-allergy-detection-query";
import { useRecipesCacheHelpers } from "./use-recipes-cache";

import { useTRPC } from "@/app/providers/trpc-provider";

export type RecipeFilters = {
  search?: string;
  searchFields?: SearchField[];
  tags?: string[];
  categories?: RecipeCategory[];
  filterMode?: "AND" | "OR";
  sortMode?: "titleAsc" | "titleDesc" | "dateAsc" | "dateDesc";
  minRating?: number;
  maxCookingTime?: number;
};

type InfiniteRecipeData = InfiniteData<{
  recipes: RecipeDashboardDTO[];
  total: number;
  nextCursor: number | null;
}>;

export type RecipesQueryResult = {
  recipes: RecipeDashboardDTO[];
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  hasMore: boolean;
  error: unknown;
  queryKey: QueryKey;
  pendingRecipeIds: Set<string>;
  autoTaggingRecipeIds: Set<string>;
  allergyDetectionRecipeIds: Set<string>;
  loadMore: () => void;
  addPendingRecipe: (id: string) => void;
  removePendingRecipe: (id: string) => void;
  addAutoTaggingRecipe: (id: string) => void;
  removeAutoTaggingRecipe: (id: string) => void;
  addAllergyDetectionRecipe: (id: string) => void;
  removeAllergyDetectionRecipe: (id: string) => void;
  setRecipesData: (
    updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined
  ) => void;
  setAllRecipesData: (
    updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined
  ) => void;
  invalidate: () => void;
};

export function useRecipesQuery(filters: RecipeFilters = {}): RecipesQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    search,
    searchFields,
    tags,
    categories,
    filterMode = "OR",
    sortMode = "dateDesc",
    minRating,
    maxCookingTime,
  } = filters;

  // Use the dedicated hooks for reading pending state
  const { pendingRecipeIds } = usePendingRecipesQuery();
  const { autoTaggingRecipeIds } = useAutoTaggingQuery();
  const { allergyDetectionRecipeIds } = useAllergyDetectionQuery();

  // Get cache helpers for mutations (add/remove)
  const {
    addPendingRecipe,
    removePendingRecipe,
    addAutoTaggingRecipe,
    removeAutoTaggingRecipe,
    addAllergyDetectionRecipe,
    removeAllergyDetectionRecipe,
  } = useRecipesCacheHelpers();

  const infiniteQueryOptions = trpc.recipes.list.infiniteQueryOptions(
    {
      limit: 100,
      search,
      searchFields,
      tags,
      categories,
      filterMode,
      sortMode,
      minRating,
      maxCookingTime,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // The actual query key used by the infinite query
  const queryKey = infiniteQueryOptions.queryKey;

  // Get base key for partial matching (to update all recipe lists regardless of filters)
  const recipesBaseKey = trpc.recipes.list.queryKey({});
  const recipesPath = useMemo(() => [recipesBaseKey[0]], [recipesBaseKey]);

  const { data, error, isLoading, isFetching, hasNextPage, fetchNextPage } =
    useInfiniteQuery(infiniteQueryOptions);

  const recipes = useMemo(() => {
    if (!data?.pages) return [];

    return data.pages.flatMap((page) => page.recipes);
  }, [data?.pages]);

  const total = data?.pages?.[0]?.total ?? 0;
  const hasMore = hasNextPage ?? false;

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      fetchNextPage();
    }
  }, [hasMore, isFetching, fetchNextPage]);

  const setRecipesData = useCallback(
    (updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined) => {
      // Update only the current query (with current filters)
      queryClient.setQueryData<InfiniteRecipeData>(queryKey, updater);
    },
    [queryClient, queryKey]
  );

  const setAllRecipesData = useCallback(
    (updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined) => {
      // Update ALL recipe list queries (regardless of filters)
      // tRPC query keys are structured as [["procedure", "path"], { input, type }]
      const queries = queryClient.getQueriesData<InfiniteRecipeData>({
        queryKey: recipesPath,
      });

      for (const [key] of queries) {
        queryClient.setQueryData<InfiniteRecipeData>(key, updater);
      }
    },
    [queryClient, recipesPath]
  );

  const invalidate = useCallback(() => {
    // Invalidate using a partial key match for all recipe lists
    queryClient.invalidateQueries({ queryKey: recipesPath });
  }, [queryClient, recipesPath]);

  return {
    recipes,
    total,
    isLoading,
    isValidating: isFetching,
    hasMore,
    error,
    queryKey,
    pendingRecipeIds,
    autoTaggingRecipeIds,
    allergyDetectionRecipeIds,
    loadMore,
    addPendingRecipe,
    removePendingRecipe,
    addAutoTaggingRecipe,
    removeAutoTaggingRecipe,
    addAllergyDetectionRecipe,
    removeAllergyDetectionRecipe,
    setRecipesData,
    setAllRecipesData,
    invalidate,
  };
}
