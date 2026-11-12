"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/**
 * Reads of what the cache holds now, without subscribing: the offline pages' verdict on whether a
 * recipe or cookbook was warmed. Call them after the restore, since nothing re-renders the reader.
 */
export function useHeldReads() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return {
    recipe: (id: string) => queryClient.getQueryData(trpc.recipes.get.queryKey({ id })),
    cookbook: (id: string) => queryClient.getQueryData(trpc.cookbooks.get.queryKey({ id })),
  };
}

/** A recipe's name as the cache holds it, never fetched: a name for a back link isn't worth a request. */
export function useHeldRecipeName(id: string | null): string | undefined {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.recipes.get.queryOptions({ id: id ?? "" }),
    enabled: false,
    select: (recipe) => recipe?.name,
  });

  return data;
}

/** Reads a recipe into the cache ahead of its page; a failure is left to the page's own read. */
export function usePrefetchRecipe(): (id: string) => void {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return (id) => void queryClient.query(trpc.recipes.get.queryOptions({ id })).catch(() => {});
}
