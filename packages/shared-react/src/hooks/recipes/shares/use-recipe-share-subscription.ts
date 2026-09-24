import type { RecipeShareLifecycleEventDto } from "@norish/shared/contracts";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";

import type { CreateRecipeHooksOptions } from "../types";
import type { RecipeShareCacheHelpers } from "./use-recipe-share-cache";
import { useRealtimeSubscription } from "../../../realtime/use-realtime-subscription";

export type RecipeShareSubscriptionCallbacks = {
  onEvent?: (payload: RecipeShareLifecycleEventDto) => void;
};

export function createUseRecipeShareSubscription(
  { useTRPC }: CreateRecipeHooksOptions,
  dependencies: {
    useRecipeShareCacheHelpers: () => RecipeShareCacheHelpers;
  }
) {
  return function useRecipeShareSubscription(
    recipeId: string | null,
    callbacks: RecipeShareSubscriptionCallbacks = {}
  ) {
    const trpc = useTRPC();
    const {
      invalidateRecipeShares,
      invalidateMyRecipeShares,
      invalidateAdminRecipeShares,
      invalidateRecipeShare,
      removeRecipeShare,
    } = dependencies.useRecipeShareCacheHelpers();

    const handleEvent = (payload: RecipeShareLifecycleEventDto) => {
      // Always invalidate inventory queries so settings pages stay fresh.
      invalidateMyRecipeShares();
      invalidateAdminRecipeShares();

      if (!recipeId || payload.recipeId !== recipeId) {
        return;
      }

      invalidateRecipeShares(payload.recipeId);

      if (payload.type === "deleted") {
        removeRecipeShare(payload.shareId);
      } else {
        invalidateRecipeShare(payload.shareId);
      }

      callbacks.onEvent?.(payload);
    };

    // One subscription for every share lifecycle transition; `share.type` says which.
    useRealtimeSubscription<PayloadOf<RecipesRealtime, "shareEvent">>(trpc.recipes.onShareEvent, {
      enabled: !!recipeId,
      onEvent: (payload) => handleEvent(payload.share),
      onLag: () => {
        invalidateMyRecipeShares();
        invalidateAdminRecipeShares();
        if (recipeId) invalidateRecipeShares(recipeId);
      },
    });
  };
}
