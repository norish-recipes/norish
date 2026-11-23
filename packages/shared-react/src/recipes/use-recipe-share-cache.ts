"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

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
      queryClient.invalidateQueries({
        queryKey: recipeId
          ? trpc.recipes.shareList.queryKey({ recipeId })
          : trpc.recipes.shareList.pathKey(),
      });
    },
    [queryClient, trpc]
  );

  const invalidateRecipeShare = useCallback(
    (shareId: string) => {
      queryClient.invalidateQueries({
        queryKey: trpc.recipes.shareGet.queryKey({ id: shareId }),
      });
    },
    [queryClient, trpc]
  );

  const invalidateMyRecipeShares = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: trpc.recipes.shareListMine.queryKey(),
    });
  }, [queryClient, trpc]);

  const invalidateAdminRecipeShares = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: trpc.recipes.shareListAdmin.queryKey(),
    });
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
