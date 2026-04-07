import { useMutation } from "@tanstack/react-query";

import type {
  CreateRecipeShareInputDto,
  UpdateRecipeShareInputDto,
} from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../types";
import type { RecipeShareCacheHelpers } from "./use-recipe-share-cache";

export type RecipeShareMutationsResult = {
  createShare: (expiresIn?: CreateRecipeShareInputDto["expiresIn"]) => void;
  updateShare: (input: UpdateRecipeShareInputDto) => void;
  revokeShare: (id: string, version: number) => void;
  reactivateShare: (id: string, version: number) => void;
  deleteShare: (id: string, version: number) => void;
  isCreating: boolean;
  isUpdating: boolean;
  isRevoking: boolean;
  isReactivating: boolean;
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
    const {
      invalidateRecipeShares,
      invalidateMyRecipeShares,
      invalidateAdminRecipeShares,
      invalidateRecipeShare,
      removeRecipeShare,
    } = dependencies.useRecipeShareCacheHelpers();

    const invalidateShareCollections = (shareId: string, recipeIdForList?: string | null) => {
      if (recipeIdForList) {
        invalidateRecipeShares(recipeIdForList);
      }

      invalidateMyRecipeShares();
      invalidateAdminRecipeShares();
      invalidateRecipeShare(shareId);
    };

    const createMutation = useMutation(
      trpc.recipes.shareCreate.mutationOptions({
        onSuccess: (data) => {
          invalidateShareCollections(data.id, data.recipeId);
        },
      })
    );

    const updateMutation = useMutation(
      trpc.recipes.shareUpdate.mutationOptions({
        onSuccess: (data) => {
          invalidateShareCollections(data.id, data.recipeId);
        },
      })
    );

    const revokeMutation = useMutation(
      trpc.recipes.shareRevoke.mutationOptions({
        onSuccess: (data) => {
          invalidateShareCollections(data.id, data.recipeId);
        },
      })
    );

    const reactivateMutation = useMutation(
      trpc.recipes.shareReactivate.mutationOptions({
        onSuccess: (data) => {
          invalidateShareCollections(data.id, data.recipeId);
        },
      })
    );

    const deleteMutation = useMutation(
      trpc.recipes.shareDelete.mutationOptions({
        onSuccess: (_data, variables) => {
          if (recipeId) {
            invalidateRecipeShares(recipeId);
          }

          invalidateMyRecipeShares();
          invalidateAdminRecipeShares();
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
      reactivateShare: (id, version) => {
        reactivateMutation.mutate({ id, version });
      },
      deleteShare: (id, version) => {
        deleteMutation.mutate({ id, version });
      },
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isRevoking: revokeMutation.isPending,
      isReactivating: reactivateMutation.isPending,
      isDeleting: deleteMutation.isPending,
    };
  };
}
