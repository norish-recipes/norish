"use client";

import { useMemo, useSyncExternalStore } from "react";
import RecipeDetailPage from "@/app/(app)/recipes/[id]/page";
import { OfflineUnavailable } from "@/app/~offline/offline-unavailable";
import { useTRPC } from "@/app/providers/trpc-provider";
import RecipeSkeleton from "@/components/skeleton/recipe-skeleton";
import { cacheManager } from "@/lib/query-cache";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Warmed-gated recipe detail for the offline bootstrap (ADR-0009): a recipe
 * inside the Warm Set renders through the normal detail page (its queries
 * read the restored cache); an id outside it gets the explicit
 * Offline-unavailable state instead of an endless skeleton. The verdict
 * waits for the persisted cache restore — before that, absence only means
 * "not hydrated yet".
 */
export function OfflineRecipeDetail({ id }: { id: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const owner = useSyncExternalStore(cacheManager.subscribe, cacheManager.owner, () => null);

  // A stable promise identity so the reused page's `use(params)` settles.
  const params = useMemo(() => Promise.resolve({ id }), [id]);

  if (!owner) {
    return <RecipeSkeleton />;
  }

  const warmed = queryClient.getQueryData(trpc.recipes.get.queryOptions({ id }).queryKey);

  if (!warmed) {
    return <OfflineUnavailable />;
  }

  return <RecipeDetailPage params={params} />;
}
