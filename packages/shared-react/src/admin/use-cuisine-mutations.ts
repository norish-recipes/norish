import { useMutation, useQueryClient } from "@tanstack/react-query";

import { answered } from "../offline/settled";
import { useTRPC } from "../trpc";

/** Why a cuisine write failed: the name is taken, or anything else. */
export type CuisineRefusal = "duplicate" | "saveFailed";

/** A Cuisine as last read: a rename or delete of an older version is refused. */
type CuisineRef = { id: string; version: number };

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

  /** Whether a write was saved; `onError` told a failed one, `refusal` names a refused answer. */
  const saved = async <T>(write: Promise<T>, refusal: (answer: T) => CuisineRefusal | null) => {
    const answer = await answered(write);
    const refused = answer === null ? null : refusal(answer);

    if (refused) onRefused(refused);

    return answer !== null && refused === null;
  };
  // Changed since it was read: the reread list shows it as it is now.
  const unlessStale = (answer: { stale: boolean }) => (answer.stale ? "saveFailed" : null);

  return {
    /** Each resolves whether it was saved. */
    create: (name: string) =>
      saved(create.mutateAsync({ kind: "cuisine", name, instance: true }), (added) =>
        added.created ? null : "duplicate"
      ),
    rename: ({ id, version }: CuisineRef, name: string) =>
      saved(rename.mutateAsync({ kind: "cuisine", id, version, name }), unlessStale),
    remove: ({ id, version }: CuisineRef) =>
      saved(remove.mutateAsync({ kind: "cuisine", id, version }), unlessStale),
    isPending: create.isPending || rename.isPending || remove.isPending,
  };
}
