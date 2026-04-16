import { useSubscription } from "@trpc/tanstack-react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Hook to track provenance inference status for a recipe via WebSockets
 */
export function useProvenanceInferenceSubscriptions(
  recipeId: string | null,
  onStarted?: () => void,
  onCompleted?: () => void
) {
  const trpc = useTRPC();

  useSubscription(
    trpc.recipes.onProvenanceInferenceStarted.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (data: any) => {
        if (data.recipeId === recipeId) {
          if (onStarted) onStarted();
        }
      },
    })
  );

  useSubscription(
    trpc.recipes.onProvenanceInferenceCompleted.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (data: any) => {
        if (data.recipeId === recipeId) {
          if (onCompleted) onCompleted();
        }
      },
    })
  );
}

