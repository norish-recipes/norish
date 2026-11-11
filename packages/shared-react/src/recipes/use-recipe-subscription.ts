"use client";

import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";

import { useKeepsCurrent, useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { useRecipeQuery } from "./use-recipe-query";

type Payload<E extends EventName<RecipesRealtime>> = PayloadOf<RecipesRealtime, E>;

export type RecipeSubscriptionCallbacks = {
  onDeleted?: (payload: Payload<"deleted">) => void;
  onFailed?: (payload: Payload<"failed">) => void;
};

/**
 * One recipe's own events. A policy change reaches this screen through the
 * permissions subscription, which invalidates the recipe list and the policy;
 * the detail query refetches on its own terms, so it is not subscribed here.
 */
export function useRecipeSubscription(
  recipeId: string | null,
  callbacks: RecipeSubscriptionCallbacks = {}
) {
  const trpc = useTRPC();
  const { queryKey, setRecipeData, invalidate } = useRecipeQuery(recipeId);

  useKeepsCurrent(recipeId ? [queryKey] : []);

  const common = { enabled: !!recipeId, onCatchUp: invalidate };

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
    },
  });

  useRealtimeSubscription<Payload<"deleted">>(trpc.recipes.onDeleted, {
    ...common,
    onEvent: (payload) => {
      if (!recipeId || !payload.ids.includes(recipeId)) return;

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
}
