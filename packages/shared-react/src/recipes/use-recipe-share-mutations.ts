"use client";

import { useMutation } from "@tanstack/react-query";

import type {
  CreateRecipeShareInputDto,
  RecipeShareCreatedDto,
  UpdateRecipeShareInputDto,
} from "@norish/shared/contracts";

import { answered } from "../offline/settled";
import { usePlatform } from "../platform/platform";
import { useStaleRefusal, wentThroughFresh } from "../platform/stale-write";
import { useTRPC } from "../trpc";
import { SECRET_ANSWER } from "../trpc/one-time-secret";
import { useRecipeShareCacheHelpers } from "./use-recipe-share-cache";

/** What a share-links table does to a link; each resolves whether its request went through. */
export type ShareLinkMutations = {
  revokeShare: (id: string, version: number) => Promise<boolean>;
  reactivateShare: (id: string, version: number) => Promise<boolean>;
  deleteShare: (id: string, version: number) => Promise<boolean>;
  isRevoking: boolean;
  isReactivating: boolean;
  isDeleting: boolean;
};

type RecipeShareMutationsResult = ShareLinkMutations & {
  createShare: (
    expiresIn?: CreateRecipeShareInputDto["expiresIn"]
  ) => Promise<RecipeShareCreatedDto | null>;
  /** Drops the new link from the mutation's result, once its panel closed. */
  forgetCreatedShare: () => void;
  updateShare: (input: UpdateRecipeShareInputDto) => void;
  isCreating: boolean;
  isUpdating: boolean;
};

export function useRecipeShareMutations(recipeId: string | null): RecipeShareMutationsResult {
  const trpc = useTRPC();
  const { toast, showError } = usePlatform();
  const refuseStale = useStaleRefusal();
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
  // A failed action rereads the lists: a share whose recipe was deleted elsewhere answers NOT_FOUND.
  const failed = (context: string) => (error: unknown) => {
    invalidateRecipeShares(recipeId);
    invalidateMyRecipeShares();
    invalidateAdminRecipeShares();
    showError(error, context);
  };

  const createMutation = useMutation(
    trpc.recipes.shareCreate.mutationOptions({
      ...SECRET_ANSWER,
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
  const { mutateAsync: mutateCreateAsync, reset: resetCreate } = createMutation;

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
        if (data.stale) refuseStale("recipe-share-panel:revoke");
        invalidateShareCollections(data.id, data.recipeId);
      },
      onError: failed("recipe-share-panel:revoke"),
    })
  );
  const { mutateAsync: mutateRevoke } = revokeMutation;

  const reactivateMutation = useMutation(
    trpc.recipes.shareReactivate.mutationOptions({
      onSuccess: (data) => {
        if (data.stale) refuseStale("recipe-share-panel:reactivate");
        invalidateShareCollections(data.id, data.recipeId);
      },
      onError: failed("recipe-share-panel:reactivate"),
    })
  );
  const { mutateAsync: mutateReactivate } = reactivateMutation;

  const deleteMutation = useMutation(
    trpc.recipes.shareDelete.mutationOptions({
      onSuccess: ({ stale }, variables) => {
        invalidateRecipeShares(recipeId);
        invalidateMyRecipeShares();
        invalidateAdminRecipeShares();
        if (stale) refuseStale("recipe-share-panel:delete");
        else removeRecipeShare(variables.id);
      },
      onError: failed("recipe-share-panel:delete"),
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
    forgetCreatedShare: () => resetCreate(),
    updateShare: (input) => {
      mutateUpdate(input);
    },
    revokeShare: (id, version) => wentThroughFresh(mutateRevoke({ id, version })),
    reactivateShare: (id, version) => wentThroughFresh(mutateReactivate({ id, version })),
    deleteShare: (id, version) => wentThroughFresh(mutateDelete({ id, version })),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRevoking: revokeMutation.isPending,
    isReactivating: reactivateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
