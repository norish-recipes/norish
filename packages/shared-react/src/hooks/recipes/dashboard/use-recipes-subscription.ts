import { useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import type { FullRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../types";
import type { InfiniteRecipeData, RecipesCacheHelpers } from "./use-recipes-cache";

export type RecipesSubscriptionCallbacks = {
  onImported?: (payload: unknown) => void;
  onConverted?: (payload: unknown) => void;
  onFailed?: (payload: unknown) => void;
  onProcessingToast?: (payload: unknown) => void;
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
      addAutoTaggingRecipe,
      removeAutoTaggingRecipe,
      addAllergyDetectionRecipe,
      removeAllergyDetectionRecipe,
    } = dependencies.useRecipesCacheHelpers();

    const asSubscriptionOptions = (options: unknown): Parameters<typeof useSubscription>[0] => {
      return options as Parameters<typeof useSubscription>[0];
    };

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
              r.id === updatedRecipe.id
                ? {
                    ...r,
                    name: updatedRecipe.name,
                    description: updatedRecipe.description,
                    image: updatedRecipe.image,
                    servings: updatedRecipe.servings,
                    prepMinutes: updatedRecipe.prepMinutes,
                    cookMinutes: updatedRecipe.cookMinutes,
                    totalMinutes: updatedRecipe.totalMinutes,
                    tags: updatedRecipe.tags,
                    categories: updatedRecipe.categories,
                    updatedAt: updatedRecipe.updatedAt,
                  }
                : r
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

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onCreated.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            removePendingRecipe(payload.recipe.id);
            addRecipeToList(payload.recipe);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onImportStarted.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            replaceOldestOptimisticPendingRecipe(payload.recipeId);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onImported.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            const pendingId = payload.pendingRecipeId ?? payload.recipe.id;

            replaceOldestOptimisticPendingRecipe(pendingId);
            removePendingRecipe(pendingId);
            addRecipeToList(payload.recipe);
            callbacks.onImported?.(payload);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onUpdated.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            updateRecipeInList(payload.recipe);
            queryClient.invalidateQueries({
              queryKey: [["recipes", "get"], { input: { id: payload.recipe.id }, type: "query" }],
            });
            queryClient.invalidateQueries({ queryKey: [["calendar", "listRecipes"]] });
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onDeleted.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            removeRecipeFromList(payload.id);
            queryClient.invalidateQueries({
              queryKey: [["recipes", "get"], { input: { id: payload.id }, type: "query" }],
            });
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onConverted.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            updateRecipeInList(payload.recipe);
            queryClient.invalidateQueries({
              queryKey: [["recipes", "get"], { input: { id: payload.recipe.id }, type: "query" }],
            });
            callbacks.onConverted?.(payload);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onFailed.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            if (payload.recipeId) {
              replaceOldestOptimisticPendingRecipe(payload.recipeId);
              removePendingRecipe(payload.recipeId);
              removeAutoTaggingRecipe(payload.recipeId);
              removeAllergyDetectionRecipe(payload.recipeId);
            }

            invalidate();
            callbacks.onFailed?.(payload);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onAutoTaggingStarted.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            addAutoTaggingRecipe(payload.recipeId);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onAllergyDetectionStarted.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            addAllergyDetectionRecipe(payload.recipeId);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onAutoTaggingCompleted.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            removeAutoTaggingRecipe(payload.recipeId);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onAllergyDetectionCompleted.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            removeAllergyDetectionRecipe(payload.recipeId);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onProcessingToast.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            callbacks.onProcessingToast?.(payload);
          },
        })
      )
    );

    useSubscription(
      asSubscriptionOptions(
        trpc.recipes.onRecipeBatchCreated.subscriptionOptions(undefined, {
          onData: ({ payload }: any) => {
            setAllRecipesData(
              (prev: InfiniteRecipeData | undefined): InfiniteRecipeData | undefined => {
                if (!prev?.pages?.length) {
                  return {
                    pages: [
                      { recipes: payload.recipes, total: payload.recipes.length, nextCursor: null },
                    ],
                    pageParams: [0],
                  };
                }

                const firstPage = prev.pages[0];

                if (!firstPage) return prev;

                const existingIds = new Set(firstPage.recipes.map((r) => r.id));
                const newRecipes = payload.recipes.filter(
                  (r: RecipeDashboardDTO) => !existingIds.has(r.id)
                );

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
        })
      )
    );
  };
}
