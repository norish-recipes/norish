"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useMutation } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

/**
 * Hook for auto-tagging functionality.
 * Provides mutation to trigger auto-tagging and subscriptions for status updates.
 */
export function useAutoTagging(
  recipeId: string | null,
  onStarted: () => void,
  onCompleted: () => void
) {
  const trpc = useTRPC();

  // Listen for auto-tagging started events
  useSubscription(
    trpc.recipes.onAutoTaggingStarted.subscriptionOptions(undefined, {
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

  // Listen for recipe updates (auto-tagging completed)
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

/**
 * Hook for triggering auto-tagging mutation.
 */
export function useAutoTaggingMutation() {
  const trpc = useTRPC();

  return useMutation(trpc.recipes.triggerAutoTag.mutationOptions());
}
