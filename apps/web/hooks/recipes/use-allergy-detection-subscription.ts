"use client";

import { useSubscription } from "@trpc/tanstack-react-query";
import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Hook for allergy detection functionality.
 * Provides subscriptions for status updates.
 */
export function useAllergyDetection(
  recipeId: string | null,
  onStarted: () => void,
  onCompleted: () => void
) {
  const trpc = useTRPC();

  // Listen for allergy detection started events
  useSubscription(
    trpc.recipes.onAllergyDetectionStarted.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload) => {
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
      onData: (payload) => {
        if (payload.recipeId === recipeId) {
          onCompleted();
        }
      },
    })
  );

  // Listen for allergy detection completed events
  useSubscription(
    trpc.recipes.onAllergyDetectionCompleted.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload) => {
        if (payload.recipeId === recipeId) {
          onCompleted();
        }
      },
    })
  );
}

/**
 * Hook for triggering allergy detection mutation.
 */
export function useAllergyDetectionMutation() {
  const trpc = useTRPC();

  return useMutation(trpc.recipes.triggerAllergyDetection.mutationOptions());
}
