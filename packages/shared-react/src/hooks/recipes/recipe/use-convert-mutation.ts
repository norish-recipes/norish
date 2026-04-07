import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { FullRecipeDTO, MeasurementSystem } from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../types";
import { shouldPreserveOptimisticUpdate as preserveOptimisticUpdate } from "../../optimistic-updates";

type ConvertMutationContext = {
  detailQueryKey: QueryKey;
  previousRecipe: FullRecipeDTO | null | undefined;
  didSwitchLocally: boolean;
};

export type ConvertMutationResult = {
  convertMeasurements: (targetSystem: MeasurementSystem, version: number) => void;
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

export function createUseConvertMutation({
  useTRPC,
  shouldPreserveOptimisticUpdate,
}: CreateRecipeHooksOptions) {
  return function useConvertMutation(recipeId: string): ConvertMutationResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const detailQueryKey = trpc.recipes.get.queryKey({ id: recipeId });

    const mutation = useMutation(
      trpc.recipes.convertMeasurements.mutationOptions({
        onMutate: async ({ targetSystem }) => {
          await queryClient.cancelQueries({ queryKey: detailQueryKey });

          const previousRecipe = queryClient.getQueryData<FullRecipeDTO | null>(detailQueryKey);
          const didSwitchLocally =
            previousRecipe != null && hasLocalMeasurementSystem(previousRecipe, targetSystem);

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
          if (preserveOptimisticUpdate(error, shouldPreserveOptimisticUpdate)) {
            return;
          }

          if (context?.didSwitchLocally) {
            queryClient.setQueryData(context.detailQueryKey, context.previousRecipe);
          }

          queryClient.invalidateQueries({ queryKey: context?.detailQueryKey ?? detailQueryKey });
        },
      })
    );

    return {
      convertMeasurements: (targetSystem: MeasurementSystem, version: number) => {
        mutation.mutate({ recipeId, targetSystem, version });
      },
      error: mutation.error,
      reset: mutation.reset,
      isConverting: mutation.isPending,
    };
  };
}
