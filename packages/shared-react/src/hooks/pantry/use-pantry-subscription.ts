import { useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import type { PantryIngredientDto } from "@norish/shared/contracts";

import type { CreatePantryHooksOptions, PantryData } from "./types";
import { mergePantryAdded, mergePantryRemoved } from "./merge";

/**
 * A housemate's Pantry lands here without a reload: the handlers are the same
 * idempotent merges the mutations' optimistic writes use, so the actor's own
 * echo is a no-op and nothing is suppressed.
 */
export function createUsePantrySubscription({ useTRPC }: CreatePantryHooksOptions) {
  return function usePantrySubscription() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.pantry.list.queryKey();

    useSubscription(
      trpc.pantry.onAdded.subscriptionOptions(undefined, {
        // Typed as the transport hands it over, like every other handler.
        onData: ({ payload }: any) => {
          const item = payload.item as PantryIngredientDto;

          queryClient.setQueryData<PantryData>(queryKey, (prev) =>
            mergePantryAdded(prev ?? [], item)
          );
        },
      })
    );

    useSubscription(
      trpc.pantry.onRemoved.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          const itemId = payload.itemId as string;

          queryClient.setQueryData<PantryData>(queryKey, (prev) =>
            mergePantryRemoved(prev ?? [], itemId)
          );
        },
      })
    );
  };
}
