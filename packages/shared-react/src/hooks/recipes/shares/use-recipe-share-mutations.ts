import type { CreateRecipeShareInputDto, UpdateRecipeShareInputDto } from "@norish/shared/contracts";
import type { CreateRecipeHooksOptions } from "../types";
import type { RecipeShareCacheHelpers } from "./use-recipe-share-cache";

import { useMutation } from "@tanstack/react-query";

export type RecipeShareMutationsResult = {
  createShare: (expiresIn?: CreateRecipeShareInputDto["expiresIn"]) => void;
  updateShare: (input: UpdateRecipeShareInputDto) => void;
  revokeShare: (id: string, version: number) => void;
  deleteShare: (id: string, version: number) => void;
  isCreating: boolean;
  isUpdating: boolean;
  isRevoking: boolean;
  isDeleting: boolean;
};

export function createUseRecipeShareMutations(
  { useTRPC }: CreateRecipeHooksOptions,
  dependencies: {
    useRecipeShareCacheHelpers: () => RecipeShareCacheHelpers;
  }
) {
  return function useRecipeShareMutations(recipeId: string | null): RecipeShareMutationsResult {
    const trpc = useTRPC();
    const { invalidateRecipeShares, invalidateRecipeShare, removeRecipeShare } =
      dependencies.useRecipeShareCacheHelpers();

    const createMutation = useMutation(
      trpc.recipes.shareCreate.mutationOptions({
        onSuccess: (data) => {
          invalidateRecipeShares(data.recipeId);
          invalidateRecipeShare(data.id);
        },
      })
    );

    const updateMutation = useMutation(
      trpc.recipes.shareUpdate.mutationOptions({
        onSuccess: (data) => {
          invalidateRecipeShares(data.recipeId);
          invalidateRecipeShare(data.id);
        },
      })
    );

    const revokeMutation = useMutation(
      trpc.recipes.shareRevoke.mutationOptions({
        onSuccess: (data) => {
          invalidateRecipeShares(data.recipeId);
          invalidateRecipeShare(data.id);
        },
      })
    );

    const deleteMutation = useMutation(
      trpc.recipes.shareDelete.mutationOptions({
        onSuccess: (_data, variables) => {
          if (recipeId) {
            invalidateRecipeShares(recipeId);
          }

          removeRecipeShare(variables.id);
        },
      })
    );

    return {
      createShare: (expiresIn = "forever") => {
        if (!recipeId) {
          return;
        }

        createMutation.mutate({ recipeId, expiresIn });
      },
      updateShare: (input) => {
        updateMutation.mutate(input);
      },
      revokeShare: (id, version) => {
        revokeMutation.mutate({ id, version });
      },
      deleteShare: (id, version) => {
        deleteMutation.mutate({ id, version });
      },
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isRevoking: revokeMutation.isPending,
      isDeleting: deleteMutation.isPending,
    };
  };
}
