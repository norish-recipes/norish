"use client";

import { useMutation } from "@tanstack/react-query";

import type {
  CreateRecipeShareInputDto,
  RecipeShareCreatedDto,
  UpdateRecipeShareInputDto,
} from "@norish/shared/contracts";

import { answered, wentThrough } from "../offline/settled";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";
import { useRecipeShareCacheHelpers } from "./use-recipe-share-cache";

type RecipeShareMutationsResult = {
  createShare: (
    expiresIn?: CreateRecipeShareInputDto["expiresIn"]
  ) => Promise<RecipeShareCreatedDto | null>;
  updateShare: (input: UpdateRecipeShareInputDto) => void;
  /** Each resolves whether its request went through; a failure is shown. */
  revokeShare: (id: string, version: number) => Promise<boolean>;
  reactivateShare: (id: string, version: number) => Promise<boolean>;
  deleteShare: (id: string, version: number) => Promise<boolean>;
  isCreating: boolean;
  isUpdating: boolean;
  isRevoking: boolean;
  isReactivating: boolean;
  isDeleting: boolean;
};

export function useRecipeShareMutations(recipeId: string | null): RecipeShareMutationsResult {
  const trpc = useTRPC();
  const { toast, showError } = usePlatform();
  const {
    invalidateRecipeShares,
    invalidateMyRecipeShares,
    invalidateAdminRecipeShares,
    invalidateRecipeShare,
    removeRecipeShare,
  } = useRecipeShareCacheHelpers();

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
        toast.show({
          severity: "success",
          title: toast.translate("recipes.sharePanel.createSuccess"),
        });
      },
      onError: (error) => showError(error, "recipe-share-panel:create"),
    })
  );
  const { mutateAsync: mutateCreateAsync } = createMutation;

  const updateMutation = useMutation(
    trpc.recipes.shareUpdate.mutationOptions({
      onSuccess: (data) => {
        invalidateShareCollections(data.id, data.recipeId);
      },
    })
  );
  const { mutate: mutateUpdate } = updateMutation;

  const revokeMutation = useMutation(
    trpc.recipes.shareRevoke.mutationOptions({
      onSuccess: (data) => {
        invalidateShareCollections(data.id, data.recipeId);
      },
      onError: (error) => showError(error, "recipe-share-panel:revoke"),
    })
  );
  const { mutateAsync: mutateRevoke } = revokeMutation;

  const reactivateMutation = useMutation(
    trpc.recipes.shareReactivate.mutationOptions({
      onSuccess: (data) => {
        invalidateShareCollections(data.id, data.recipeId);
      },
      onError: (error) => showError(error, "recipe-share-panel:reactivate"),
    })
  );
  const { mutateAsync: mutateReactivate } = reactivateMutation;

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
      onError: (error) => showError(error, "recipe-share-panel:delete"),
    })
  );
  const { mutateAsync: mutateDelete } = deleteMutation;

  return {
    createShare: async (expiresIn = "forever") => {
      if (!recipeId) {
        return null;
      }

      return answered(mutateCreateAsync({ recipeId, expiresIn }));
    },
    updateShare: (input) => {
      mutateUpdate(input);
    },
    revokeShare: (id, version) => wentThrough(mutateRevoke({ id, version })),
    reactivateShare: (id, version) => wentThrough(mutateReactivate({ id, version })),
    deleteShare: (id, version) => wentThrough(mutateDelete({ id, version })),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRevoking: revokeMutation.isPending,
    isReactivating: reactivateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
