import type { inferRouterInputs } from "@trpc/server";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";
import { createClientId } from "@norish/shared/lib/operation-helpers";

import type { PantryData, PantryMutationsResult, PickedFood } from "./types";
import {
  invalidateUnlessPreserved,
  shouldPreserveOptimisticUpdate,
} from "../offline/optimistic-updates";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";
import { projectedMutation } from "../trpc/projected-mutation";
import { mergePantryAdded, mergePantryRemoved } from "./pantry-merge";

/** An add as sent, and the name its failure's toast shows. */
type Add = { payload: inferRouterInputs<AppRouter>["pantry"]["add"]; shownAs?: string };

export function usePantryMutations(): PantryMutationsResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = usePlatform();

  const pantryKey = trpc.pantry.list.queryKey();

  const refetch = () => void queryClient.invalidateQueries({ queryKey: pantryKey });

  // Each answer is handled in useMutation's own options, which run whatever is mounted: a `mutate`
  // call's own callbacks are dropped once its observer mutates again.
  const addMutation = useMutation({
    ...projectedMutation(trpc.pantry.add.mutationOptions(), ({ payload }: Add) => payload),
    onSuccess: (heldId, { payload: { id } }) => {
      // The household already had the food: the server answered with that item's id, and the
      // tentative row is one too many.
      if (id && heldId !== id) {
        queryClient.setQueryData<PantryData>(pantryKey, (prev) =>
          mergePantryRemoved(prev ?? [], id)
        );
      }
    },
    onError: (error, { shownAs }) =>
      invalidateUnlessPreserved(() => {
        refetch();
        toast.show({
          severity: "danger",
          title: shownAs
            ? toast.translate("groceries.pantry.keepFailed", { name: shownAs })
            : toast.translate("groceries.panel.keepFailed"),
        });
      })(error),
  });
  const removeOptions = trpc.pantry.remove.mutationOptions({
    onError: invalidateUnlessPreserved(refetch),
  });
  const { mutateAsync: mutateAdd } = addMutation;
  const removeMutation = useMutation(removeOptions);
  const { mutate: mutateRemove } = removeMutation;

  // Optimistic insert under a client-minted id the server honours (ADR-0003), so a queued add
  // stays addressable; a picked food carries its Ingredient, a typed one only its name.
  const addPantryIngredient = (food: string | PickedFood, shownAs?: string) => {
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
    return mutateAdd({ payload, shownAs }).catch((error: unknown) =>
      shouldPreserveOptimisticUpdate(error) ? id : null
    );
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
