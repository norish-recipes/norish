import { useMutation } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseAllergyDetection({ useTRPC }: CreateRecipeHooksOptions) {
  return function useAllergyDetection(
    recipeId: string | null,
    onStarted: () => void,
    onCompleted: () => void
  ) {
    const trpc = useTRPC();

    useSubscription(
      trpc.recipes.onAllergyDetectionStarted.subscriptionOptions(undefined, {
        enabled: !!recipeId,
        onData: ({ payload }: any) => {
          if (payload.recipeId === recipeId) {
            onStarted();
          }
        },
      })
    );

    useSubscription(
      trpc.recipes.onFailed.subscriptionOptions(undefined, {
        enabled: !!recipeId,
        onData: ({ payload }: any) => {
          if (payload.recipeId === recipeId) {
            onCompleted();
          }
        },
      })
    );

    useSubscription(
      trpc.recipes.onAllergyDetectionCompleted.subscriptionOptions(undefined, {
        enabled: !!recipeId,
        onData: ({ payload }: any) => {
          if (payload.recipeId === recipeId) {
            onCompleted();
          }
        },
      })
    );
  };
}

export function createUseAllergyDetectionMutation({ useTRPC }: CreateRecipeHooksOptions) {
  return function useAllergyDetectionMutation() {
    const trpc = useTRPC();

    return useMutation(trpc.recipes.triggerAllergyDetection.mutationOptions());
  };
}
