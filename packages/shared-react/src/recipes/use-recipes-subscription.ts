"use client";

import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { FullRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";
import { patchDashboardRecipeFromFull } from "@norish/shared/contracts/zod";

import type { InfiniteRecipeData } from "./library-cache";
import { useRealtimeSubscription } from "../realtime/use-realtime-subscription";
import { useTRPC } from "../trpc";
import { useRecipeSelection } from "./selection-store";
import { removeRecipesFromLists, useRecipesCacheHelpers } from "./use-recipes-cache";

type Payload<E extends EventName<RecipesRealtime>> = PayloadOf<RecipesRealtime, E>;

export type RecipeOutcomesSubscriptionCallbacks = {
  onImported?: (payload: Payload<"imported">) => void;
  onFailed?: (payload: Payload<"failed">) => void;
  /** The reader's delete found these recipes edited elsewhere and kept them. */
  onDeleteKept?: (payload: Payload<"deleteKept">) => void;
};

/** Put new recipes at the top of a cached list, each once. */
function prependRecipes(recipes: RecipeDashboardDTO[]) {
  return (prev: InfiniteRecipeData | undefined): InfiniteRecipeData | undefined => {
    if (!prev?.pages?.length) {
      return {
        pages: [{ recipes, total: recipes.length, nextCursor: null }],
        pageParams: [0],
      };
    }

    const firstPage = prev.pages[0];

    if (!firstPage) return prev;

    const existingIds = new Set(firstPage.recipes.map((r) => r.id));
    const newRecipes = recipes.filter((r) => !existingIds.has(r.id));

    if (newRecipes.length === 0) return prev;

    return {
      ...prev,
      pages: [
        {
          ...firstPage,
          recipes: [...newRecipes, ...firstPage.recipes],
          total: firstPage.total + newRecipes.length,
        },
        ...prev.pages.slice(1),
      ],
    };
  };
}

/**
 * The outcomes of imports and deletes, which the reader starts on any page: mounted once in
 * the shell. An import takes its pending card and ends in a recipe or a failure.
 */
export function useRecipeOutcomesSubscription(callbacks: RecipeOutcomesSubscriptionCallbacks = {}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const {
    setAllRecipesData,
    invalidate,
    replaceOldestOptimisticPendingRecipe,
    removePendingRecipe,
  } = useRecipesCacheHelpers();

  const rereadPending = () =>
    void queryClient.invalidateQueries({ queryKey: trpc.recipes.getPending.queryKey() });
  // A fresh subscription carries no cursor, so an import that ended before both outcomes'
  // subscriptions were live reaches neither: the pending list is reread once both are.
  const liveOutcomesRef = useRef({ imported: false, failed: false });
  const outcomeLive = (outcome: "imported" | "failed") => () => {
    liveOutcomesRef.current[outcome] = true;

    if (!liveOutcomesRef.current.imported || !liveOutcomesRef.current.failed) return;

    liveOutcomesRef.current = { imported: false, failed: false };
    rereadPending();
  };
  // A lag restarts one outcome alone, which never completes the pair, so its catch-up rereads
  // the pending list as well as the lists.
  const outcomeLag = {
    onLag: () => {
      invalidate();
      rereadPending();
    },
  };

  useRealtimeSubscription<Payload<"importStarted">>(trpc.recipes.onImportStarted, {
    onLag: invalidate,
    onEvent: ({ recipeId }) => {
      replaceOldestOptimisticPendingRecipe(recipeId);
    },
  });

  useRealtimeSubscription<Payload<"imported">>(trpc.recipes.onImported, {
    ...outcomeLag,
    onStarted: outcomeLive("imported"),
    onEvent: (payload) => {
      const pendingId = payload.pendingRecipeId ?? payload.recipe.id;

      replaceOldestOptimisticPendingRecipe(pendingId);
      removePendingRecipe(pendingId);
      setAllRecipesData(prependRecipes([payload.recipe]));
      callbacks.onImported?.(payload);
    },
  });

  useRealtimeSubscription<Payload<"failed">>(trpc.recipes.onFailed, {
    ...outcomeLag,
    onStarted: outcomeLive("failed"),
    onEvent: (payload) => {
      if (payload.recipeId) {
        replaceOldestOptimisticPendingRecipe(payload.recipeId);
        removePendingRecipe(payload.recipeId);
      }

      invalidate();
      callbacks.onFailed?.(payload);
    },
  });

  useRealtimeSubscription<Payload<"deleteKept">>(trpc.recipes.onDeleteKept, {
    onLag: invalidate,
    // The kept recipes left the lists tentatively; refetching brings them back.
    onEvent: (payload) => {
      invalidate();
      for (const id of payload.ids) {
        void queryClient.invalidateQueries({ queryKey: trpc.recipes.get.queryKey({ id }) });
      }
      callbacks.onDeleteKept?.(payload);
    },
  });
}

/** The Library's list events: recipes created, edited, converted and deleted anywhere. */
export function useRecipeListSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setAllRecipesData, invalidate, removePendingRecipe } = useRecipesCacheHelpers();
  const dropFromSelection = useRecipeSelection((state) => state.drop);

  // A lagged subscription refetches the lists; the detail caches are
  // refetched by the screens that hold them.
  const lag = { onLag: invalidate };
  // The server saves after the mutation answers, so the household's Categories
  // are reread when the save is announced, not when the mutation succeeds.
  const rereadCategories = () =>
    void queryClient.invalidateQueries({ queryKey: trpc.config.categories.queryKey() });

  const updateRecipeInList = (updatedRecipe: FullRecipeDTO) => {
    setAllRecipesData((prev: InfiniteRecipeData | undefined): InfiniteRecipeData | undefined => {
      if (!prev?.pages) return prev;

      return {
        ...prev,
        pages: prev.pages.map((page) => ({
          ...page,
          recipes: page.recipes.map((r) =>
            r.id === updatedRecipe.id ? patchDashboardRecipeFromFull(r, updatedRecipe) : r
          ),
        })),
      };
    });
  };

  useRealtimeSubscription<Payload<"created">>(trpc.recipes.onCreated, {
    ...lag,
    onEvent: ({ recipe }) => {
      removePendingRecipe(recipe.id);
      setAllRecipesData(prependRecipes([recipe]));
      rereadCategories();
    },
  });

  useRealtimeSubscription<Payload<"updated">>(trpc.recipes.onUpdated, {
    ...lag,
    onEvent: ({ recipe, source }) => {
      updateRecipeInList(recipe);
      queryClient.setQueryData(trpc.recipes.get.queryKey({ id: recipe.id }), recipe);

      // An enrichment changes no Category.
      if (source !== "enrichment") rereadCategories();
    },
  });

  useRealtimeSubscription<Payload<"deleted">>(trpc.recipes.onDeleted, {
    ...lag,
    onEvent: ({ ids }) => {
      setAllRecipesData((prev) => removeRecipesFromLists(prev, new Set(ids)));
      dropFromSelection(ids);
      rereadCategories();

      for (const id of ids) {
        void queryClient.invalidateQueries({ queryKey: trpc.recipes.get.queryKey({ id }) });
      }
    },
  });

  useRealtimeSubscription<Payload<"converted">>(trpc.recipes.onConverted, {
    ...lag,
    onEvent: (payload) => {
      updateRecipeInList(payload.recipe);
      void queryClient.invalidateQueries({
        queryKey: trpc.recipes.get.queryKey({ id: payload.recipe.id }),
      });
    },
  });

  useRealtimeSubscription<Payload<"recipeBatchCreated">>(trpc.recipes.onRecipeBatchCreated, {
    ...lag,
    onEvent: ({ recipes }) => setAllRecipesData(prependRecipes(recipes)),
  });
}
