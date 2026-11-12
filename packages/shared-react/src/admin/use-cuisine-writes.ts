import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/** Why a cuisine write failed: the name is taken, or anything else. */
export type CuisineRefusal = "duplicate" | "saveFailed";

const refusalOf = (write: Promise<unknown>): Promise<CuisineRefusal | null> =>
  write.then(
    () => null,
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "data" in error &&
      (error as { data?: { code?: string } }).data?.code === "CONFLICT"
        ? "duplicate"
        : "saveFailed"
  );

/**
 * Adds, renames and deletes cuisines. Each rereads the vocabulary rather than patching it: every
 * screen offering cuisines, the recipe form's picker included, must offer the new set.
 */
export function useCuisineWrites() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const reread = () => queryClient.invalidateQueries({ queryKey: trpc.config.cuisines.queryKey() });

  const create = useMutation(trpc.admin.cuisines.create.mutationOptions({ onSuccess: reread }));
  const rename = useMutation(trpc.admin.cuisines.rename.mutationOptions({ onSuccess: reread }));
  const remove = useMutation(trpc.admin.cuisines.delete.mutationOptions({ onSuccess: reread }));

  return {
    /** Each resolves null once saved and reread, else why not. */
    create: (name: string) => refusalOf(create.mutateAsync({ name })),
    rename: (id: string, name: string) => refusalOf(rename.mutateAsync({ id, name })),
    remove: (id: string) => refusalOf(remove.mutateAsync({ id })),
    isPending: create.isPending || rename.isPending || remove.isPending,
  };
}
