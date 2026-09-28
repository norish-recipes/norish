import { useQueryClient } from "@tanstack/react-query";

import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { IngredientsRealtime } from "@norish/shared/contracts/realtime/ingredients";

import type { CreateIngredientsHooksOptions } from "./types";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";

/**
 * A merge, an alias move or a rename anywhere on the instance changes which
 * food a grocery, a recurring grocery or a Pantry Ingredient means, and so
 * which Aisle, Product Link and price it reads (ADR-0037). Everything derived
 * from an Ingredient is read again: a refetch is idempotent, so the actor's
 * own echo and a replay change nothing, and a lagged subscription does the
 * same.
 */
export function createUseIngredientsSubscription({ useTRPC }: CreateIngredientsHooksOptions) {
  return function useIngredientsSubscription() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const derived = [
      trpc.ingredients.pathKey(),
      trpc.groceries.list.queryKey(),
      trpc.pantry.list.queryKey(),
      trpc.stores.aisleLinks.queryKey(),
      trpc.stores.groceryPrices.queryKey(),
      trpc.stores.linkFor.queryKey(),
    ];

    useRealtimeSubscription<PayloadOf<IngredientsRealtime, "changed">>(trpc.ingredients.onChanged, {
      lagQueryKeys: derived,
      onEvent: () => {
        for (const queryKey of derived) void queryClient.invalidateQueries({ queryKey });
      },
    });
  };
}
