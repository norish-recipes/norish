import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createClientId } from "@norish/shared/lib/operation-helpers";

import type { PantryData, PantryMutationsResult, PickedFood } from "./types";
import {
  invalidateUnlessPreserved,
  shouldPreserveOptimisticUpdate,
} from "../offline/optimistic-updates";
import { useTRPC } from "../trpc";
import { mergePantryAdded, mergePantryRemoved } from "./pantry-merge";

export function usePantryMutations(): PantryMutationsResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const pantryKey = trpc.pantry.list.queryKey();

  const refetch = () => void queryClient.invalidateQueries({ queryKey: pantryKey });

  // Each answer is handled in useMutation's own options, which run whatever is mounted: a `mutate`
  // call's own callbacks are dropped once its observer mutates again.
  const addOptions = trpc.pantry.add.mutationOptions({
    onSuccess: (heldId, { id }) => {
      // The household already had the food: the server answered with that item's id, and the
      // tentative row is one too many.
      if (id && heldId !== id) {
        queryClient.setQueryData<PantryData>(pantryKey, (prev) =>
          mergePantryRemoved(prev ?? [], id)
        );
      }
    },
    onError: invalidateUnlessPreserved(refetch),
  });
  const removeOptions = trpc.pantry.remove.mutationOptions({
    onError: invalidateUnlessPreserved(refetch),
  });
  const addMutation = useMutation(addOptions);
  const { mutateAsync: mutateAdd } = addMutation;
  const removeMutation = useMutation(removeOptions);
  const { mutate: mutateRemove } = removeMutation;

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
      queryClient.setQueryData<PantryData>(pantryKey, (prev) =>
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

    // Queued for Replay, the add stands under the id it was sent with.
    return mutateAdd(payload).catch((error: unknown) => {
      if (shouldPreserveOptimisticUpdate(error)) return id;
      throw error;
    });
  };

  const removePantryIngredient = (id: string) => {
    queryClient.setQueryData<PantryData>(pantryKey, (prev) => mergePantryRemoved(prev ?? [], id));
    mutateRemove({ id });
  };

  return {
    addPantryIngredient,
    removePantryIngredient,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
