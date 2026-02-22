"use client";

import { useMutation } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export function useAutoCategorization(
  recipeId: string | null,
  onStarted: () => void,
  onCompleted: () => void
) {
  const trpc = useTRPC();

  useSubscription(
    trpc.recipes.onAutoCategorizationStarted.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload) => {
        if (payload.recipeId === recipeId) {
          onStarted();
        }
      },
    })
  );

  useSubscription(
    trpc.recipes.onAutoCategorizationCompleted.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload) => {
        if (payload.recipeId === recipeId) {
          onCompleted();
        }
      },
    })
  );

  useSubscription(
    trpc.recipes.onUpdated.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload) => {
        if (payload.recipe.id === recipeId) {
          onCompleted();
        }
      },
    })
  );

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

  useSubscription(
    trpc.recipes.onUpdated.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload) => {
        if (payload.recipe.id === recipeId) {
          onCompleted();
        }
      },
    })
  );
}

export function useAutoCategorizationMutation() {
  const trpc = useTRPC();

  return useMutation(trpc.recipes.triggerAutoCategorize.mutationOptions());
}
