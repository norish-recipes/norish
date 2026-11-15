"use client";

import type { RecipeShareLifecycleEventDto } from "@norish/shared/contracts";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";

import { useKeepsCurrent, useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { useRecipeShareCacheHelpers } from "./use-recipe-share-cache";

type RecipeShareSubscriptionCallbacks = {
  onEvent?: (payload: RecipeShareLifecycleEventDto) => void;
};

export function useRecipeShareSubscription(
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
  } = useRecipeShareCacheHelpers();

  useKeepsCurrent(recipeId ? [trpc.recipes.shareList.queryKey({ recipeId })] : []);

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
    liveQueryKeys: [
      trpc.recipes.shareListMine.queryKey(),
      trpc.recipes.shareListAdmin.queryKey(),
      trpc.recipes.shareGet.pathKey(),
      ...(recipeId ? [trpc.recipes.shareList.queryKey({ recipeId })] : []),
    ],
  });
}
