"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useSubscription } from "@trpc/tanstack-react-query";

export function useNutritionSubscription(
  recipeId: string | null,
  onStarted: () => void,
  onCompleted: () => void
) {
  const trpc = useTRPC();

  // Listen for nutrition estimation started events
  useSubscription(
    trpc.recipes.onNutritionStarted.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload: any) => {
        if (payload.recipeId === recipeId) {
          onStarted();
        }
      },
    })
  );

  // Listen for failed events
  useSubscription(
    trpc.recipes.onFailed.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload: any) => {
        if (payload.recipeId === recipeId) {
          onCompleted();
        }
      },
    })
  );

  // Listen for recipe updates (nutrition completed)
  useSubscription(
    trpc.recipes.onUpdated.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload: any) => {
        if (payload.recipe.id === recipeId) {
          onCompleted();
        }
      },
    })
  );
}
