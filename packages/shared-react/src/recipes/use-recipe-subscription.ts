"use client";

import { useQueryClient } from "@tanstack/react-query";

import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";

import { olderThanHeld } from "../offline/version-order";
import { useKeepsCurrent, useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { useRecipeQuery } from "./use-recipe-query";

type Payload<E extends EventName<RecipesRealtime>> = PayloadOf<RecipesRealtime, E>;

type RecipeSubscriptionCallbacks = {
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
  const queryClient = useQueryClient();
  const { queryKey, setRecipeData, invalidate } = useRecipeQuery(recipeId);

  useKeepsCurrent(recipeId ? [queryKey] : []);

  const common = { enabled: !!recipeId, liveQueryKeys: [queryKey] };
  const write = (recipe: Payload<"updated">["recipe"]) => {
    if (recipe.id !== recipeId) return;
    setRecipeData((cached) => (olderThanHeld(recipe.version, cached?.version) ? cached : recipe));
    // Its lines may read differently now.
    void queryClient.invalidateQueries({ queryKey: trpc.recipes.lineReadings.pathKey() });
  };

  useRealtimeSubscription<Payload<"updated">>(trpc.recipes.onUpdated, {
    ...common,
    onEvent: ({ recipe }) => write(recipe),
  });

  useRealtimeSubscription<Payload<"converted">>(trpc.recipes.onConverted, {
    ...common,
    onEvent: ({ recipe }) => write(recipe),
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
