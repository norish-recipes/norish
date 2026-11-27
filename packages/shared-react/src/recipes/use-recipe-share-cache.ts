"use client";

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

  return {
    invalidateRecipeShares: (recipeId) => {
      void rereadAfterWrite(
        queryClient,
        recipeId ? trpc.recipes.shareList.queryKey({ recipeId }) : trpc.recipes.shareList.pathKey()
      );
    },
    invalidateMyRecipeShares: () => {
      void rereadAfterWrite(queryClient, trpc.recipes.shareListMine.queryKey());
    },
    invalidateAdminRecipeShares: () => {
      void rereadAfterWrite(queryClient, trpc.recipes.shareListAdmin.queryKey());
    },
    invalidateRecipeShare: (shareId) => {
      void rereadAfterWrite(queryClient, trpc.recipes.shareGet.queryKey({ id: shareId }));
    },
    removeRecipeShare: (shareId) => {
      queryClient.removeQueries({ queryKey: trpc.recipes.shareGet.queryKey({ id: shareId }) });
    },
  };
}
