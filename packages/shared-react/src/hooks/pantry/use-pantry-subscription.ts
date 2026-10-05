import { useQueryClient } from "@tanstack/react-query";

import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { PantryRealtime } from "@norish/shared/contracts/realtime/pantry";

import type { CreatePantryHooksOptions, PantryData } from "./types";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";
import { mergePantryAdded, mergePantryRemoved } from "./merge";

type Payload<E extends EventName<PantryRealtime>> = PayloadOf<PantryRealtime, E>;

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
    // What the Pantry covers is what "From your recipes" leaves out.
    const suggestionsKey = trpc.pantry.suggestions.queryKey();
    // A lagged subscription reads the Pantry again; the merges cannot close a gap.
    const lag = { lagQueryKeys: [queryKey, suggestionsKey] };

    useRealtimeSubscription<Payload<"added">>(trpc.pantry.onAdded, {
      ...lag,
      onEvent: ({ item }) => {
        queryClient.setQueryData<PantryData>(queryKey, (prev) =>
          mergePantryAdded(prev ?? [], item)
        );
        void queryClient.invalidateQueries({ queryKey: suggestionsKey });
      },
    });

    useRealtimeSubscription<Payload<"removed">>(trpc.pantry.onRemoved, {
      ...lag,
      onEvent: ({ itemId }) => {
        queryClient.setQueryData<PantryData>(queryKey, (prev) =>
          mergePantryRemoved(prev ?? [], itemId)
        );
        void queryClient.invalidateQueries({ queryKey: suggestionsKey });
      },
    });
  };
}
