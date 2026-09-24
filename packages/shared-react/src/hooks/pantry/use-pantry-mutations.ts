import { useMutation } from "@tanstack/react-query";

import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";
import { createClientId } from "@norish/shared/lib/operation-helpers";

import type { CreatePantryHooksOptions, PantryMutationsResult, PantryQueryResult } from "./types";
import {
  invalidateUnlessPreserved,
  shouldPreserveOptimisticUpdate as preserveOptimisticUpdate,
} from "../optimistic-updates";
import { mergePantryAdded, mergePantryRemoved } from "./merge";

type CreateUsePantryMutationsOptions = CreatePantryHooksOptions & {
  usePantryQuery: () => PantryQueryResult;
};

export function createUsePantryMutations({
  useTRPC,
  usePantryQuery,
}: CreateUsePantryMutationsOptions) {
  return function usePantryMutations(): PantryMutationsResult {
    const trpc = useTRPC();
    const { setPantryData, invalidate } = usePantryQuery();

    const addMutation = useMutation(trpc.pantry.add.mutationOptions());
    const removeMutation = useMutation(trpc.pantry.remove.mutationOptions());

    /**
     * The name joins the Pantry on this screen at once, folded here as the
     * server will fold it, under a client-minted id the server honours
     * (ADR-0003) — so a queued offline add stays addressable and the
     * add-to-groceries panel can already leave the name off the list.
     */
    const addPantryIngredient = (name: string): Promise<string> => {
      const payload = { id: createClientId(), name: name.trim() };
      const insertOptimistic = () =>
        setPantryData((prev) =>
          mergePantryAdded(prev ?? [], {
            id: payload.id,
            // The Ingredient Name the server will point at is not known
            // here, any more than the member is. Nothing on screen reads
            // either, and the echo replaces this row under its own id.
            userId: "",
            ingredientId: "",
            name: payload.name,
            normalizedName: normalizeGroceryName(payload.name),
            version: 1,
          })
        );

      insertOptimistic();

      return new Promise((resolve, reject) => {
        addMutation.mutate(payload, {
          onSuccess: (id) => {
            // The household already had the name: the server answered with
            // that item's id, and the tentative row is one too many.
            if (id !== payload.id)
              setPantryData((prev) => mergePantryRemoved(prev ?? [], payload.id));
            resolve(id);
          },
          onError: (error) => {
            if (preserveOptimisticUpdate(error)) {
              resolve(payload.id);

              return;
            }

            invalidate();
            reject(error);
          },
        });
      });
    };

    const removePantryIngredient = (id: string) => {
      setPantryData((prev) => mergePantryRemoved(prev ?? [], id));
      removeMutation.mutate({ id }, { onError: invalidateUnlessPreserved(invalidate) });
    };

    return {
      addPantryIngredient,
      removePantryIngredient,
      isAdding: addMutation.isPending,
      isRemoving: removeMutation.isPending,
    };
  };
}
