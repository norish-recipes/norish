import { useQueryClient } from "@tanstack/react-query";

import type { FullRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";
import { patchDashboardRecipeFromFull } from "@norish/shared/contracts/zod";

import type { CreateRecipeHooksOptions } from "../types";
import type { InfiniteRecipeData, RecipesCacheHelpers } from "./use-recipes-cache";
import { useRealtimeSubscription } from "../../../realtime/use-realtime-subscription";

type Payload<E extends EventName<RecipesRealtime>> = PayloadOf<RecipesRealtime, E>;

export type RecipesSubscriptionCallbacks = {
  onImported?: (payload: Payload<"imported">) => void;
  onConverted?: (payload: Payload<"converted">) => void;
  onFailed?: (payload: Payload<"failed">) => void;
};

export function createUseRecipesSubscription(
  { useTRPC }: CreateRecipeHooksOptions,
  dependencies: {
    useRecipesCacheHelpers: () => RecipesCacheHelpers;
  }
) {
  return function useRecipesSubscription(callbacks: RecipesSubscriptionCallbacks = {}) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const {
      setAllRecipesData,
      invalidate,
      replaceOldestOptimisticPendingRecipe,
      removePendingRecipe,
    } = dependencies.useRecipesCacheHelpers();

    // A lagged subscription refetches the lists; the detail caches are
    // refetched by the screens that hold them.
    const lag = { onLag: invalidate };

    const addRecipeToList = (recipe: RecipeDashboardDTO) => {
      setAllRecipesData((prev: InfiniteRecipeData | undefined): InfiniteRecipeData | undefined => {
        if (!prev?.pages?.length) {
          return {
            pages: [{ recipes: [recipe], total: 1, nextCursor: null }],
            pageParams: [0],
          };
        }

        const firstPage = prev.pages[0];

        if (!firstPage) return prev;

        const exists = firstPage.recipes.some((r) => r.id === recipe.id);

        if (exists) return prev;

        return {
          ...prev,
          pages: [
            { ...firstPage, recipes: [recipe, ...firstPage.recipes], total: firstPage.total + 1 },
            ...prev.pages.slice(1),
          ],
        };
      });
    };

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

    const removeRecipeFromList = (id: string) => {
      setAllRecipesData((prev: InfiniteRecipeData | undefined): InfiniteRecipeData | undefined => {
        if (!prev?.pages) return prev;

        const recipeExists = prev.pages.some((page) => page.recipes.some((r) => r.id === id));

        if (!recipeExists) return prev;

        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            recipes: page.recipes.filter((r) => r.id !== id),
            total: Math.max(page.total - 1, 0),
          })),
        };
      });
    };

    useRealtimeSubscription<Payload<"created">>(trpc.recipes.onCreated, {
      ...lag,
      onEvent: ({ recipe }) => {
        removePendingRecipe(recipe.id);
        addRecipeToList(recipe);
      },
    });

    useRealtimeSubscription<Payload<"importStarted">>(trpc.recipes.onImportStarted, {
      ...lag,
      onEvent: ({ recipeId }) => {
        replaceOldestOptimisticPendingRecipe(recipeId);
      },
    });

    useRealtimeSubscription<Payload<"imported">>(trpc.recipes.onImported, {
      ...lag,
      onEvent: (payload) => {
        const pendingId = payload.pendingRecipeId ?? payload.recipe.id;

        replaceOldestOptimisticPendingRecipe(pendingId);
        removePendingRecipe(pendingId);
        addRecipeToList(payload.recipe);
        callbacks.onImported?.(payload);
      },
    });

    useRealtimeSubscription<Payload<"updated">>(trpc.recipes.onUpdated, {
      ...lag,
      onEvent: ({ recipe, source }) => {
        updateRecipeInList(recipe);
        queryClient.setQueryData(trpc.recipes.get.queryKey({ id: recipe.id }), recipe);

        // The calendar shows the recipe's name and image; an enrichment
        // changes neither.
        if (source !== "enrichment") {
          void queryClient.invalidateQueries({ queryKey: trpc.calendar.listItems.queryKey() });
        }
      },
    });

    useRealtimeSubscription<Payload<"deleted">>(trpc.recipes.onDeleted, {
      ...lag,
      onEvent: ({ id }) => {
        removeRecipeFromList(id);
        void queryClient.invalidateQueries({ queryKey: trpc.recipes.get.queryKey({ id }) });
      },
    });

    useRealtimeSubscription<Payload<"converted">>(trpc.recipes.onConverted, {
      ...lag,
      onEvent: (payload) => {
        updateRecipeInList(payload.recipe);
        void queryClient.invalidateQueries({
          queryKey: trpc.recipes.get.queryKey({ id: payload.recipe.id }),
        });
        callbacks.onConverted?.(payload);
      },
    });

    useRealtimeSubscription<Payload<"failed">>(trpc.recipes.onFailed, {
      ...lag,
      onEvent: (payload) => {
        if (payload.recipeId) {
          replaceOldestOptimisticPendingRecipe(payload.recipeId);
          removePendingRecipe(payload.recipeId);
        }

        invalidate();
        callbacks.onFailed?.(payload);
      },
    });

    useRealtimeSubscription<Payload<"recipeBatchCreated">>(trpc.recipes.onRecipeBatchCreated, {
      ...lag,
      onEvent: ({ recipes }) => {
        setAllRecipesData(
          (prev: InfiniteRecipeData | undefined): InfiniteRecipeData | undefined => {
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
          }
        );
      },
    });
  };
}
