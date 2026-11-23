"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "../trpc";
import { rereadAfterWrite } from "../trpc/read-status";

/** Each reread starts after the write: a first read under way predates it (`rereadAfterWrite`). */
type RecipeShareCacheHelpers = {
  /** Null rereads every recipe's list, for an action whose recipe the caller does not know. */
  invalidateRecipeShares: (recipeId: string | null) => void;
  invalidateMyRecipeShares: () => void;
  invalidateAdminRecipeShares: () => void;
  invalidateRecipeShare: (shareId: string) => void;
  removeRecipeShare: (shareId: string) => void;
};

export function useRecipeShareCacheHelpers(): RecipeShareCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateRecipeShares = useCallback(
    (recipeId: string | null) => {
      void rereadAfterWrite(
        queryClient,
        recipeId ? trpc.recipes.shareList.queryKey({ recipeId }) : trpc.recipes.shareList.pathKey()
      );
    },
    [queryClient, trpc]
  );

  const invalidateRecipeShare = useCallback(
    (shareId: string) => {
      void rereadAfterWrite(queryClient, trpc.recipes.shareGet.queryKey({ id: shareId }));
    },
    [queryClient, trpc]
  );

  const invalidateMyRecipeShares = useCallback(() => {
    void rereadAfterWrite(queryClient, trpc.recipes.shareListMine.queryKey());
  }, [queryClient, trpc]);

  const invalidateAdminRecipeShares = useCallback(() => {
    void rereadAfterWrite(queryClient, trpc.recipes.shareListAdmin.queryKey());
  }, [queryClient, trpc]);

  const removeRecipeShare = useCallback(
    (shareId: string) => {
      queryClient.removeQueries({
        queryKey: trpc.recipes.shareGet.queryKey({ id: shareId }),
      });
    },
    [queryClient, trpc]
  );

  return {
    invalidateRecipeShares,
    invalidateMyRecipeShares,
    invalidateAdminRecipeShares,
    invalidateRecipeShare,
    removeRecipeShare,
  };
}
