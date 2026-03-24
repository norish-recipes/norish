import { useState } from "react";
import { useSubscription } from "@trpc/tanstack-react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Hook to track provenance inference status for a recipe via WebSockets
 */
export function useProvenanceInference(
  recipeId: string | null,
  onStarted?: () => void,
  onCompleted?: () => void
) {
  const trpc = useTRPC();
  const [isInferring, setIsInferring] = useState(false);

  useSubscription(
    trpc.recipes.onProvenanceInferenceStarted.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (data) => {
        if (data.recipeId === recipeId) {
          setIsInferring(true);
          onStarted?.();
        }
      },
    })
  );

  useSubscription(
    trpc.recipes.onProvenanceInferenceCompleted.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (data) => {
        if (data.recipeId === recipeId) {
          setIsInferring(false);
          onCompleted?.();
        }
      },
    })
  );

  return {
    isInferring,
    setIsInferring,
  };
}
