"use client";

import type { ComponentType, ReactNode } from "react";
import { OfflineUnavailable } from "@/app/~offline/offline-unavailable";
import { offlineEngine } from "@/lib/offline/engine";
import { useQueryClient } from "@tanstack/react-query";

import type { LibraryTypeFilter } from "@norish/shared/contracts";
import { useCacheOwner } from "@norish/shared-react/offline/react";
import { useTRPC } from "@norish/shared-react/trpc";

/**
 * Warmed-gated recipe detail for the offline bootstrap (ADR-0009): a recipe
 * inside the Warm Set renders through the recipe screen (its queries
 * read the restored cache); an id outside it gets the explicit
 * Offline-unavailable state instead of an endless skeleton. The verdict
 * waits for the persisted cache restore — before that, absence only means
 * "not hydrated yet".
 */
export function OfflineRecipeDetail({
  id,
  libraryType,
  Screen,
  skeleton,
}: {
  id: string;
  libraryType: LibraryTypeFilter;
  Screen: ComponentType<{ recipeId: string; libraryType: LibraryTypeFilter }>;
  skeleton: ReactNode;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const owner = useCacheOwner(offlineEngine.cache);

  if (!owner) {
    return skeleton;
  }

  const warmed = queryClient.getQueryData(trpc.recipes.get.queryOptions({ id }).queryKey);

  if (!warmed) {
    return <OfflineUnavailable />;
  }

  return <Screen libraryType={libraryType} recipeId={id} />;
}
