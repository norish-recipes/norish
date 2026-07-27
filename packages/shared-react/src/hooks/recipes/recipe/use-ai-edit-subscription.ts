import { useMutation } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseAiEdit({ useTRPC }: CreateRecipeHooksOptions) {
  return function useAiEdit(
    recipeId: string | null,
    onStarted: () => void,
    onCompleted: () => void
  ) {
    const trpc = useTRPC();

    useSubscription(
      trpc.recipes.onAiEditStarted.subscriptionOptions(undefined, {
        enabled: !!recipeId,
        onData: ({ payload }: any) => {
          if (payload.recipeId === recipeId) {
            onStarted();
          }
        },
      })
    );

    useSubscription(
      trpc.recipes.onAiEditCompleted.subscriptionOptions(undefined, {
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
  };
}

export function createUseAiEditMutation({ useTRPC }: CreateRecipeHooksOptions) {
  return function useAiEditMutation() {
    const trpc = useTRPC();

    return useMutation(trpc.recipes.aiEdit.mutationOptions());
  };
}
