import { useSubscription } from "@trpc/tanstack-react-query";

import type { ProvenanceStatus } from "@norish/shared/lib/provenance";

import type { CreateRecipeHooksOptions } from "../types";

/**
 * Low-latency provenance lifecycle signal. Realtime events are not the source of
 * truth — each one simply nudges the caller (which refetches the authoritative
 * status query). The recipe `updated` event refreshes the recipe content itself.
 */
export function createUseProvenanceSubscription({ useTRPC }: CreateRecipeHooksOptions) {
  return function useProvenanceSubscription(
    recipeId: string | null,
    onEvent: (status: ProvenanceStatus) => void
  ) {
    const trpc = useTRPC();

    useSubscription(
      trpc.recipes.onProvenance.subscriptionOptions(undefined, {
        enabled: !!recipeId,
        onData: ({ payload }: any) => {
          const data = payload as { recipeId: string; status: ProvenanceStatus };

          if (data.recipeId === recipeId) {
            onEvent(data.status);
          }
        },
      })
    );
  };
}
