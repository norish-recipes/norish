"use client";

import { useCallback } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Cuisine vocabulary writes.
 *
 * Every one of them invalidates the vocabulary query rather than patching the
 * cache, because a rename and a delete both change what every other screen —
 * including the recipe form's picker — is allowed to offer.
 */
export function useCuisineAdminMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const vocabularyKey = trpc.config.cuisines.queryKey();

  const createMutation = useMutation(trpc.admin.cuisines.create.mutationOptions());
  const renameMutation = useMutation(trpc.admin.cuisines.rename.mutationOptions());
  const deleteMutation = useMutation(trpc.admin.cuisines.delete.mutationOptions());

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: vocabularyKey }),
    [queryClient, vocabularyKey]
  );

  const create = useCallback(
    async (name: string) => {
      await createMutation.mutateAsync({ name });
      await invalidate();
    },
    [createMutation, invalidate]
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameMutation.mutateAsync({ id, name });
      await invalidate();
    },
    [renameMutation, invalidate]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync({ id });
      await invalidate();
    },
    [deleteMutation, invalidate]
  );

  return {
    create,
    rename,
    remove,
    isPending: createMutation.isPending || renameMutation.isPending || deleteMutation.isPending,
  };
}
