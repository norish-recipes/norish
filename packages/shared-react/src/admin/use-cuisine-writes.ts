import type { TRPCClientErrorLike } from "@trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";

import { wentThrough } from "../offline/settled";
import { useTRPC } from "../trpc";

/** Why a cuisine write failed: the name is taken, or anything else. */
export type CuisineRefusal = "duplicate" | "saveFailed";

/**
 * Adds, renames and deletes cuisines, then rereads the vocabulary every cuisine picker offers.
 * A failed write hands `onRefused` why.
 */
export function useCuisineWrites(onRefused: (refusal: CuisineRefusal) => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const handlers = {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.config.cuisines.queryKey() }),
    onError: (error: TRPCClientErrorLike<AppRouter>) =>
      onRefused(error.data?.code === "CONFLICT" ? "duplicate" : "saveFailed"),
  };

  const create = useMutation(trpc.admin.cuisines.create.mutationOptions(handlers));
  const rename = useMutation(trpc.admin.cuisines.rename.mutationOptions(handlers));
  const remove = useMutation(trpc.admin.cuisines.delete.mutationOptions(handlers));

  return {
    /** Each resolves whether it was saved. */
    create: (name: string) => wentThrough(create.mutateAsync({ name })),
    rename: (id: string, name: string) => wentThrough(rename.mutateAsync({ id, name })),
    remove: (id: string) => wentThrough(remove.mutateAsync({ id })),
    isPending: create.isPending || rename.isPending || remove.isPending,
  };
}
