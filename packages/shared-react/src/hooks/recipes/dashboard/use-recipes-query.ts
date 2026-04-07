import type { InfiniteData, QueryKey } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import type { RecipeCategory, RecipeDashboardDTO, SearchField } from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../types";
import type { RecipesCacheHelpers } from "./use-recipes-cache";

export type RecipeFilters = {
  limit?: number;
  search?: string;
  searchFields?: SearchField[];
  tags?: string[];
  categories?: RecipeCategory[];
  filterMode?: "AND" | "OR";
  sortMode?: "titleAsc" | "titleDesc" | "dateAsc" | "dateDesc" | "none";
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
  invalidate: () => Promise<void>;
};

export interface RecipesQueryDependencies {
  usePendingRecipesQuery: () => { pendingRecipeIds: Set<string> };
  useAutoTaggingQuery: () => { autoTaggingRecipeIds: Set<string> };
  useAllergyDetectionQuery: () => { allergyDetectionRecipeIds: Set<string> };
  useRecipesCacheHelpers: () => RecipesCacheHelpers;
}

export function createUseRecipesQuery(
  { useTRPC }: CreateRecipeHooksOptions,
  {
    usePendingRecipesQuery,
    useAutoTaggingQuery,
    useAllergyDetectionQuery,
    useRecipesCacheHelpers,
  }: RecipesQueryDependencies
) {
  return function useRecipesQuery(filters: RecipeFilters = {}): RecipesQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const {
      limit = 100,
      search,
      searchFields,
      tags,
      categories,
      filterMode = "OR",
      sortMode = "dateDesc",
      minRating,
      maxCookingTime,
    } = filters;

    const { pendingRecipeIds } = usePendingRecipesQuery();
    const { autoTaggingRecipeIds } = useAutoTaggingQuery();
    const { allergyDetectionRecipeIds } = useAllergyDetectionQuery();

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
        limit,
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

    const queryKey = infiniteQueryOptions.queryKey;
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
        queryClient.setQueryData<InfiniteRecipeData>(queryKey, updater);
      },
      [queryClient, queryKey]
    );

    const setAllRecipesData = useCallback(
      (updater: (prev: InfiniteRecipeData | undefined) => InfiniteRecipeData | undefined) => {
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
      return queryClient.invalidateQueries({ queryKey: recipesPath });
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
  };
}
