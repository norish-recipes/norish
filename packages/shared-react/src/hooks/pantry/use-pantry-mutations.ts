import { useMutation } from "@tanstack/react-query";

import { createClientId } from "@norish/shared/lib/operation-helpers";

import type {
  CreatePantryHooksOptions,
  PantryMutationsResult,
  PantryQueryResult,
  PickedFood,
} from "./types";
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
     * The food joins the Pantry on this screen at once, under a client-minted
     * id the server honours (ADR-0003) — so a queued offline add stays
     * addressable and the add-to-groceries panel can already leave it off
     * the list. A picked food carries its Ingredient and names, so coverage
     * and "on the list" work before the server answers; a typed name is only
     * text until then, and is matched on its name.
     */
    const addPantryIngredient = (food: string | PickedFood): Promise<string> => {
      const id = createClientId();
      const picked = typeof food === "string" ? null : food;
      const name = typeof food === "string" ? food.trim() : food.name;
      const payload = picked ? { id, ingredientId: picked.ingredientId } : { id, name };
      const insertOptimistic = () =>
        setPantryData((prev) =>
          mergePantryAdded(prev ?? [], {
            id,
            // The member is not known here, any more than a typed name's
            // Ingredient is; the echo replaces this row under its own id.
            userId: "",
            ingredientId: picked?.ingredientId ?? "",
            name,
            ancestorIds: picked?.ancestorIds ?? [],
            localeNames: picked?.localeNames ?? {},
            version: 1,
          })
        );

      insertOptimistic();

      return new Promise((resolve, reject) => {
        addMutation.mutate(payload, {
          onSuccess: (heldId) => {
            // The household already had the food: the server answered with
            // that item's id, and the tentative row is one too many.
            if (heldId !== id) setPantryData((prev) => mergePantryRemoved(prev ?? [], id));
            resolve(heldId);
          },
          onError: (error) => {
            if (preserveOptimisticUpdate(error)) {
              resolve(id);

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
