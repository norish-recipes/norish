"use client";

import { useMutation } from "@tanstack/react-query";

import type { ShareLinkMutations } from "./use-recipe-share-mutations";
import { usePlatform } from "../platform/platform";
import { useStaleRefusal, wentThroughFresh } from "../platform/stale-write";
import { useTRPC } from "../trpc";
import { useRecipeShareCacheHelpers } from "./use-recipe-share-cache";

/** Share-link moderation: an admin revokes, reactivates or deletes any account's link. */
export function useAdminRecipeShareMutations(): ShareLinkMutations {
  const trpc = useTRPC();
  const { showError } = usePlatform();
  const refuseStale = useStaleRefusal();
  const {
    invalidateRecipeShares,
    invalidateMyRecipeShares,
    invalidateAdminRecipeShares,
    invalidateRecipeShare,
    removeRecipeShare,
  } = useRecipeShareCacheHelpers();

  const reread = () => {
    invalidateAdminRecipeShares();
    invalidateMyRecipeShares();
    invalidateRecipeShares(null);
  };
  const failed = (context: string) => (error: unknown) => {
    reread();
    showError(error, context);
  };
  const settled = (context: string) => (data: { id: string; stale: boolean }) => {
    if (data.stale) refuseStale(context);
    reread();
    invalidateRecipeShare(data.id);
  };

  const revokeMutation = useMutation(
    trpc.recipes.shareRevokeAdmin.mutationOptions({
      onSuccess: settled("admin-share-links:revoke"),
      onError: failed("admin-share-links:revoke"),
    })
  );
  const reactivateMutation = useMutation(
    trpc.recipes.shareReactivateAdmin.mutationOptions({
      onSuccess: settled("admin-share-links:reactivate"),
      onError: failed("admin-share-links:reactivate"),
    })
  );
  const deleteMutation = useMutation(
    trpc.recipes.shareDeleteAdmin.mutationOptions({
      onSuccess: ({ stale }, variables) => {
        reread();
        if (stale) refuseStale("admin-share-links:delete");
        else removeRecipeShare(variables.id);
      },
      onError: failed("admin-share-links:delete"),
    })
  );
  const { mutateAsync: revoke } = revokeMutation;
  const { mutateAsync: reactivate } = reactivateMutation;
  const { mutateAsync: remove } = deleteMutation;

  return {
    revokeShare: (id, version) => wentThroughFresh(revoke({ id, version })),
    reactivateShare: (id, version) => wentThroughFresh(reactivate({ id, version })),
    deleteShare: (id, version) => wentThroughFresh(remove({ id, version })),
    isRevoking: revokeMutation.isPending,
    isReactivating: reactivateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
