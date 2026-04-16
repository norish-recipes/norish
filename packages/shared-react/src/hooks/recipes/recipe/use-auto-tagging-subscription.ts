import { useMutation } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseAutoTagging({ useTRPC }: CreateRecipeHooksOptions) {
  return function useAutoTagging(
    recipeId: string | null,
    onStarted: () => void,
    onCompleted: () => void
  ) {
    const trpc = useTRPC();

    useSubscription(
      trpc.recipes.onAutoTaggingStarted.subscriptionOptions(undefined, {
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
      trpc.recipes.onUpdated.subscriptionOptions(undefined, {
        enabled: !!recipeId,
        onData: ({ payload }: any) => {
          if (payload.recipe.id === recipeId) {
            onCompleted();
          }
        },
      })
    );
  };
}

export function createUseAutoTaggingMutation({ useTRPC }: CreateRecipeHooksOptions) {
  return function useAutoTaggingMutation() {
    const trpc = useTRPC();

    return useMutation(trpc.recipes.triggerAutoTag.mutationOptions());
  };
}
