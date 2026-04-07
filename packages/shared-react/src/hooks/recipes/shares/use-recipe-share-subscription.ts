import { useSubscription } from "@trpc/tanstack-react-query";

import type { RecipeShareLifecycleEventDto } from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../types";
import type { RecipeShareCacheHelpers } from "./use-recipe-share-cache";

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

    const asSubscriptionOptions = (options: unknown): Parameters<typeof useSubscription>[0] => {
      return options as Parameters<typeof useSubscription>[0];
    };

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

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onShareCreated.subscriptionOptions(undefined, {
          enabled: !!recipeId,
          onData: ({ payload }: any) => {
            handleEvent(payload);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onShareUpdated.subscriptionOptions(undefined, {
          enabled: !!recipeId,
          onData: ({ payload }: any) => {
            handleEvent(payload);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onShareRevoked.subscriptionOptions(undefined, {
          enabled: !!recipeId,
          onData: ({ payload }: any) => {
            handleEvent(payload);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onShareDeleted.subscriptionOptions(undefined, {
          enabled: !!recipeId,
          onData: ({ payload }: any) => {
            handleEvent(payload);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onShareReactivated.subscriptionOptions(undefined, {
          enabled: !!recipeId,
          onData: ({ payload }: any) => {
            handleEvent(payload);
          },
        })
      )
    );
  };
}
