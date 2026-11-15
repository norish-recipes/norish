"use client";

import { useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/** Reads a recipe into the cache ahead of its page; a failure is left to the page's own read. */
export function usePrefetchRecipe(): (id: string) => void {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return (id) => void queryClient.query(trpc.recipes.get.queryOptions({ id })).catch(() => {});
}
