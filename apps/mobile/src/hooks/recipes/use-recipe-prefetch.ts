import type { RecipeListRow } from "@/lib/recipes/build-recipe-list-rows";
import type { createTRPCContext } from "@trpc/tanstack-react-query";
import type { ViewToken } from "react-native";
import { useCallback, useEffect, useRef } from "react";
import * as prefetchBudget from "@/lib/query-cache/prefetch-budget";
import { useTRPC } from "@/providers/trpc-provider";
import { useQueryClient } from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";

type TrpcProxy = ReturnType<ReturnType<typeof createTRPCContext<AppRouter>>["useTRPC"]>;

const DEBOUNCE_MS = 300;
const RETRY_DELAY_MS = 1000;

/**
 * Prefetches full recipe data (`recipes.get`) for recipe cards currently
 * visible in a `FlatList`, using the viewability callback.
 *
 * - Debounces by {@link DEBOUNCE_MS} to avoid bursts during fast scrolling.
 * - Tracks prefetched IDs via the budget tracker and evicts the oldest
 *   when {@link prefetchBudget.MAX_PREFETCHED_RECIPES} is exceeded.
 * - Failures are silent; one retry after {@link RETRY_DELAY_MS}.
 */
export function useRecipePrefetch() {
  const trpc = useTRPC() as TrpcProxy;

  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestItemsRef = useRef<ViewToken[]>([]);

  const getQueryKey = useCallback(
    (id: string) => trpc.recipes.get.queryOptions({ id }).queryKey,
    [trpc.recipes.get]
  );

  const prefetchBatch = useCallback(() => {
    const items = latestItemsRef.current;

    for (const item of items) {
      const row = item.item as RecipeListRow;

      if (row.type !== "recipe") continue;

      const recipeId = row.recipe.id;

      // Skip if already tracked or cached with fresh data.
      if (prefetchBudget.has(recipeId)) continue;

      const queryKey = getQueryKey(recipeId);
      const existing = queryClient.getQueryData(queryKey);

      if (existing) continue;

      // Fire the prefetch. Errors are silently retried once.
      queryClient
        .prefetchQuery(trpc.recipes.get.queryOptions({ id: recipeId }))
        .then(() => {
          prefetchBudget.add(recipeId, queryClient, getQueryKey);
        })
        .catch(() => {
          // Single retry after delay
          setTimeout(() => {
            queryClient
              .prefetchQuery(trpc.recipes.get.queryOptions({ id: recipeId }))
              .then(() => {
                prefetchBudget.add(recipeId, queryClient, getQueryKey);
              })
              .catch(() => {
                // Silently abandon — the recipe will load on tap.
              });
          }, RETRY_DELAY_MS);
        });
    }
  }, [queryClient, trpc.recipes.get, getQueryKey]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      latestItemsRef.current = viewableItems;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(prefetchBatch, DEBOUNCE_MS);
    },
    [prefetchBatch]
  );

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { onViewableItemsChanged };
}
