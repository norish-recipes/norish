import { useSubscription } from "@trpc/tanstack-react-query";

import type { CreateRecipeHooksOptions } from "../types";
import type { RecipeQueryResult } from "./use-recipe-query";

export type RecipeSubscriptionCallbacks = {
  onConverted?: (payload: unknown) => void;
  onDeleted?: (payload: unknown) => void;
  onFailed?: (payload: unknown) => void;
};

export function createUseRecipeSubscription(
  { useTRPC }: CreateRecipeHooksOptions,
  dependencies: {
    useRecipeQuery: (id: string | null) => Pick<RecipeQueryResult, "setRecipeData" | "invalidate">;
  }
) {
  return function useRecipeSubscription(
    recipeId: string | null,
    callbacks: RecipeSubscriptionCallbacks = {}
  ) {
    const trpc = useTRPC();
    const { setRecipeData, invalidate } = dependencies.useRecipeQuery(recipeId);

    const asSubscriptionOptions = (options: unknown): Parameters<typeof useSubscription>[0] => {
      return options as Parameters<typeof useSubscription>[0];
    };

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onUpdated.subscriptionOptions(undefined, {
          enabled: !!recipeId,
          onData: ({ payload }: any) => {
            if (payload.recipe.id !== recipeId) return;

            setRecipeData(() => payload.recipe);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onConverted.subscriptionOptions(undefined, {
          enabled: !!recipeId,
          onData: ({ payload }: any) => {
            if (payload.recipe.id !== recipeId) return;

            setRecipeData(() => payload.recipe);
            callbacks.onConverted?.(payload);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onDeleted.subscriptionOptions(undefined, {
          enabled: !!recipeId,
          onData: ({ payload }: any) => {
            if (payload.id !== recipeId) return;

            callbacks.onDeleted?.(payload);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onFailed.subscriptionOptions(undefined, {
          enabled: !!recipeId,
          onData: ({ payload }: any) => {
            if (payload.recipeId !== recipeId) return;

            invalidate();
            callbacks.onFailed?.(payload);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.permissions.onPolicyUpdated.subscriptionOptions(undefined, {
          enabled: !!recipeId,
          onData: () => {
            invalidate();
          },
        })
      )
    );
  };
}
