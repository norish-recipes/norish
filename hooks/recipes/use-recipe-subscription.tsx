"use client";

import { useSubscription } from "@trpc/tanstack-react-query";
import { addToast } from "@heroui/react";
import { useRouter } from "next/navigation";

import { useRecipeQuery } from "./use-recipe-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Hook that subscribes to WebSocket events for a single recipe
 * and updates the query cache accordingly.
 */
export function useRecipeSubscription(recipeId: string | null) {
  const trpc = useTRPC();
  const router = useRouter();
  const { setRecipeData, invalidate } = useRecipeQuery(recipeId);

  // onUpdated - Recipe updated
  useSubscription(
    trpc.recipes.onUpdated.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload) => {
        if (payload.recipe.id !== recipeId) return;

        setRecipeData(() => payload.recipe);
      },
    })
  );

  // onConverted - Recipe measurements converted
  useSubscription(
    trpc.recipes.onConverted.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload) => {
        if (payload.recipe.id !== recipeId) return;

        setRecipeData(() => payload.recipe);

        addToast({
          severity: "success",
          title: "Measurements converted",
          description: `Recipe converted to ${payload.recipe.systemUsed} units`,
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
      },
    })
  );

  // onDeleted - Recipe deleted
  useSubscription(
    trpc.recipes.onDeleted.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload) => {
        if (payload.id !== recipeId) return;

        addToast({
          severity: "warning",
          title: "Recipe deleted",
          description: "This recipe has been removed.",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });

        router.push("/");
      },
    })
  );

  // onFailed - Operation failed
  useSubscription(
    trpc.recipes.onFailed.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: (payload) => {
        if (payload.recipeId !== recipeId) return;

        // Invalidate to get correct state
        invalidate();

        addToast({
          severity: "danger",
          title: "Recipe operation failed",
          description: payload.reason,
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
      },
    })
  );

  // Listen for permission policy changes and revalidate
  useSubscription(
    trpc.permissions.onPolicyUpdated.subscriptionOptions(undefined, {
      enabled: !!recipeId,
      onData: () => {
        // Revalidate to check if user still has access
        invalidate();
      },
    })
  );
}
