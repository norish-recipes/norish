import { useMutation, useQueryClient } from "@tanstack/react-query";

import { wentThrough } from "../offline/settled";
import { useTRPC } from "../trpc";

/** Why a cuisine write failed: the name is taken, or anything else. */
export type CuisineRefusal = "duplicate" | "saveFailed";

/**
 * Adds, renames and deletes the instance's Cuisines, then rereads the list every cuisine picker
 * offers. A failed write hands `onRefused` why; adding a name already there is a duplicate.
 */
export function useCuisineMutations(onRefused: (refusal: CuisineRefusal) => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const reread = () => queryClient.invalidateQueries({ queryKey: trpc.config.cuisines.queryKey() });
  const handlers = {
    onSuccess: reread,
    onError: () => onRefused("saveFailed"),
  };

  const create = useMutation(trpc.lists.add.mutationOptions(handlers));
  const rename = useMutation(trpc.lists.rename.mutationOptions(handlers));
  const remove = useMutation(trpc.lists.delete.mutationOptions(handlers));

  return {
    /** Each resolves whether it was saved. */
    create: async (name: string) => {
      const added = await create
        .mutateAsync({ kind: "cuisine", name, instance: true })
        .catch(() => null);

      if (added && !added.created) onRefused("duplicate");

      return added?.created === true;
    },
    rename: (id: string, name: string) =>
      wentThrough(rename.mutateAsync({ kind: "cuisine", id, name })),
    remove: (id: string) => wentThrough(remove.mutateAsync({ kind: "cuisine", id })),
    isPending: create.isPending || rename.isPending || remove.isPending,
  };
}
