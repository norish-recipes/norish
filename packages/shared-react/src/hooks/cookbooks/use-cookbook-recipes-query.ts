import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import type { RecipeDashboardDTO } from "@norish/shared/contracts";

import type { RecipeFilters } from "../recipes/dashboard";
import type { CreateCookbookHooksOptions } from "./types";

type InfiniteMemberPages = {
  pages: { recipes: RecipeDashboardDTO[]; total: number; nextCursor: number | null }[];
  pageParams: unknown[];
};

/**
 * Which cookbook a cached member list belongs to.
 *
 * A tRPC query key carries its input in the second element, so this reads the
 * cookbook out of the key rather than the caller having to know every filter
 * combination someone might have keyed a list with.
 */
export function cookbookIdOf(key: readonly unknown[]): string | undefined {
  const input = (key[1] as { input?: { cookbookId?: unknown } } | undefined)?.input;

  return typeof input?.cookbookId === "string" ? input.cookbookId : undefined;
}

export type CookbookRecipesQueryResult = {
  recipes: RecipeDashboardDTO[];
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  hasMore: boolean;
  loadMore: () => void;
  invalidate: () => void;
  /**
   * Take a member out of this cookbook's member lists. Written rather than
   * refetched, so an unfile made Offline reads as tentatively applied
   * (ADR-0009).
   */
  removeMember: (recipeId: string) => void;
};

/**
 * One cookbook's members, read through the recipe list itself, so the page
 * honours the reader's stored sort, search and filters and pages the same way
 * the Library does.
 */
export function createUseCookbookRecipesQuery({ useTRPC }: CreateCookbookHooksOptions) {
  return function useCookbookRecipesQuery(
    cookbookId: string,
    filters: RecipeFilters & { favoritesOnly?: boolean } = {},
    { enabled = true }: { enabled?: boolean } = {}
  ): CookbookRecipesQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const {
      limit = 50,
      search,
      searchFields,
      tags,
      categories,
      filterMode = "AND",
      sortMode = "dateDesc",
      minRating,
      maxCookingTime,
      favoritesOnly = false,
    } = filters;

    const infiniteQueryOptions = trpc.cookbooks.recipes.infiniteQueryOptions(
      {
        cookbookId,
        limit,
        search,
        searchFields,
        tags,
        categories,
        filterMode,
        sortMode,
        minRating,
        maxCookingTime,
        favoritesOnly,
      },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );
    const queryKey = infiniteQueryOptions.queryKey;
    const memberListPath = useMemo(
      () => [trpc.cookbooks.recipes.queryKey({ cookbookId })[0]],
      [trpc, cookbookId]
    );

    const { data, isLoading, isFetching, hasNextPage, fetchNextPage } = useInfiniteQuery({
      ...infiniteQueryOptions,
      enabled: enabled && Boolean(cookbookId),
    });

    const recipes = useMemo(
      () => data?.pages?.flatMap((page) => page.recipes) ?? [],
      [data?.pages]
    );
    const hasMore = hasNextPage ?? false;

    return {
      recipes,
      total: data?.pages?.[0]?.total ?? 0,
      isLoading,
      isValidating: isFetching,
      hasMore,
      loadMore: useCallback(() => {
        if (hasMore && !isFetching) fetchNextPage();
      }, [hasMore, isFetching, fetchNextPage]),
      invalidate: useCallback(() => {
        void queryClient.invalidateQueries({ queryKey });
      }, [queryClient, queryKey]),
      removeMember: useCallback(
        (recipeId: string) => {
          // Every cached member list for this cookbook, whatever sort, search
          // or filters keyed it — the panel that removes a member reads the
          // default filters, while the cookbook page reads the reader's own,
          // and Offline there is no refetch to reconcile the two.
          for (const [key] of queryClient.getQueriesData<InfiniteMemberPages>({
            queryKey: memberListPath,
          })) {
            if (cookbookIdOf(key) !== cookbookId) continue;

            queryClient.setQueryData<InfiniteMemberPages>(key, (previous) => {
              if (!previous?.pages) return previous;

              return {
                ...previous,
                pages: previous.pages.map((page) => {
                  const kept = page.recipes.filter((recipe) => recipe.id !== recipeId);

                  return {
                    ...page,
                    recipes: kept,
                    total: Math.max(0, page.total - (page.recipes.length - kept.length)),
                  };
                }),
              };
            });
          }
        },
        [queryClient, memberListPath, cookbookId]
      ),
    };
  };
}
