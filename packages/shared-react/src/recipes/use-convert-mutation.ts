"use client";

import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { FullRecipeDTO, MeasurementSystem } from "@norish/shared/contracts";

import { shouldPreserveOptimisticUpdate } from "../offline/optimistic-updates";
import { useTRPC } from "../trpc";

type ConvertMutationContext = {
  detailQueryKey: QueryKey;
  previousRecipe: FullRecipeDTO | null | undefined;
  didSwitchLocally: boolean;
};

type ConvertMutationResult = {
  convertMeasurements: (targetSystem: MeasurementSystem, version: number, withAI?: boolean) => void;
  error: unknown;
  reset: () => void;
  isConverting: boolean;
};

function hasLocalMeasurementSystem(recipe: FullRecipeDTO, target: MeasurementSystem): boolean {
  const hasTargetIngredients = recipe.recipeIngredients.some(
    (ingredient) => ingredient.systemUsed === target
  );
  const hasTargetSteps =
    recipe.steps.length === 0 || recipe.steps.some((step) => step.systemUsed === target);

  return hasTargetIngredients && hasTargetSteps;
}

type ConvertMutationCallbacks = {
  /** A conversion failed and was rolled back; a queued one keeps its switch and is not reported. */
  onError?: (error: unknown) => void;
};

export function useConvertMutation(
  recipeId: string,
  callbacks: ConvertMutationCallbacks = {}
): ConvertMutationResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const detailQueryKey = trpc.recipes.get.queryKey({ id: recipeId });

  const mutation = useMutation(
    trpc.recipes.convertMeasurements.mutationOptions({
      onMutate: async ({ targetSystem, withAI }) => {
        await queryClient.cancelQueries({ queryKey: detailQueryKey });

        const previousRecipe = queryClient.getQueryData<FullRecipeDTO | null>(detailQueryKey);
        // With AI the copy is written again, so there is nothing to switch to yet.
        const didSwitchLocally =
          !withAI &&
          previousRecipe != null &&
          hasLocalMeasurementSystem(previousRecipe, targetSystem);

        if (didSwitchLocally) {
          queryClient.setQueryData<FullRecipeDTO | null>(detailQueryKey, (currentRecipe) => {
            if (!currentRecipe) {
              return currentRecipe;
            }

            return {
              ...currentRecipe,
              systemUsed: targetSystem,
            };
          });
        }

        return {
          detailQueryKey,
          previousRecipe,
          didSwitchLocally,
        } satisfies ConvertMutationContext;
      },
      onError: (error, _variables, context) => {
        if (shouldPreserveOptimisticUpdate(error)) {
          return;
        }

        const previous = context?.didSwitchLocally ? context.previousRecipe : null;

        // Only its own switch is undone; a newer recipe is left for the reread.
        if (previous)
          queryClient.setQueryData<FullRecipeDTO | null>(detailQueryKey, (current) =>
            current?.version === previous.version
              ? { ...current, systemUsed: previous.systemUsed }
              : current
          );

        queryClient.invalidateQueries({ queryKey: context?.detailQueryKey ?? detailQueryKey });
        callbacks.onError?.(error);
      },
    })
  );
  const { mutate: mutateMutation } = mutation;

  return {
    convertMeasurements: (targetSystem, version, withAI = false) => {
      mutateMutation({ recipeId, targetSystem, version, withAI });
    },
    error: mutation.error,
    reset: mutation.reset,
    isConverting: mutation.isPending,
  };
}
