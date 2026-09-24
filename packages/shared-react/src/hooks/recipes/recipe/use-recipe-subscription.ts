import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";

import type { CreateRecipeHooksOptions } from "../types";
import type { RecipeQueryResult } from "./use-recipe-query";
import { useRealtimeSubscription } from "../../../realtime/use-realtime-subscription";

type Payload<E extends EventName<RecipesRealtime>> = PayloadOf<RecipesRealtime, E>;

export type RecipeSubscriptionCallbacks = {
  onConverted?: (payload: Payload<"converted">) => void;
  onDeleted?: (payload: Payload<"deleted">) => void;
  onFailed?: (payload: Payload<"failed">) => void;
};

/**
 * One recipe's own events. A policy change reaches this screen through the
 * permissions subscription, which invalidates the recipe list and the policy;
 * the detail query refetches on its own terms, so it is not subscribed here.
 */
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

    const common = { enabled: !!recipeId, onLag: invalidate };

    useRealtimeSubscription<Payload<"updated">>(trpc.recipes.onUpdated, {
      ...common,
      onEvent: (payload) => {
        if (payload.recipe.id !== recipeId) return;

        setRecipeData(() => payload.recipe);
      },
    });

    useRealtimeSubscription<Payload<"converted">>(trpc.recipes.onConverted, {
      ...common,
      onEvent: (payload) => {
        if (payload.recipe.id !== recipeId) return;

        setRecipeData(() => payload.recipe);
        callbacks.onConverted?.(payload);
      },
    });

    useRealtimeSubscription<Payload<"deleted">>(trpc.recipes.onDeleted, {
      ...common,
      onEvent: (payload) => {
        if (payload.id !== recipeId) return;

        callbacks.onDeleted?.(payload);
      },
    });

    useRealtimeSubscription<Payload<"failed">>(trpc.recipes.onFailed, {
      ...common,
      onEvent: (payload) => {
        if (payload.recipeId !== recipeId) return;

        invalidate();
        callbacks.onFailed?.(payload);
      },
    });
  };
}
