import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../types";

export type RecipeShareCacheHelpers = {
  invalidateRecipeShares: (recipeId: string) => void;
  invalidateMyRecipeShares: () => void;
  invalidateAdminRecipeShares: () => void;
  invalidateRecipeShare: (shareId: string) => void;
  removeRecipeShare: (shareId: string) => void;
};

export function createUseRecipeShareCacheHelpers({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRecipeShareCacheHelpers(): RecipeShareCacheHelpers {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const invalidateRecipeShares = useCallback(
      (recipeId: string) => {
        queryClient.invalidateQueries({
          queryKey: trpc.recipes.shareList.queryKey({ recipeId }),
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
  };
}
