import { useSubscription } from "@trpc/tanstack-react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseNutritionSubscription({ useTRPC }: CreateRecipeHooksOptions) {
  return function useNutritionSubscription(
    recipeId: string | null,
    onStarted: () => void,
    onCompleted: () => void
  ) {
    const trpc = useTRPC();

    useSubscription(
      trpc.recipes.onNutritionStarted.subscriptionOptions(undefined, {
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
