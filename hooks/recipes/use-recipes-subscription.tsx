"use client";

import type { RecipeDashboardDTO, FullRecipeDTO } from "@/types";
import type { InfiniteData } from "@tanstack/react-query";

import { useSubscription } from "@trpc/tanstack-react-query";
import { useQueryClient } from "@tanstack/react-query";
import { addToast, Button } from "@heroui/react";
import Link from "next/link";

import { useRecipesQuery } from "./use-recipes-query";
import { usePendingRecipesQuery } from "./use-pending-recipes-query";

import { useTRPC } from "@/app/providers/trpc-provider";
import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("recipes-subscription");

type InfiniteRecipeData = InfiniteData<{
  recipes: RecipeDashboardDTO[];
  total: number;
  nextCursor: number | null;
}>;

/**
 * Hook that subscribes to all recipe-related WebSocket events
 * and updates the query cache accordingly.
 *
 * Also hydrates pending recipes from the server on mount.
 */
export function useRecipesSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setAllRecipesData, invalidate, addPendingRecipe, removePendingRecipe } =
    useRecipesQuery();

  // Hydrate pending recipes from the server on mount
  usePendingRecipesQuery();

  const addRecipeToList = (recipe: RecipeDashboardDTO) => {
    setAllRecipesData((prev: InfiniteRecipeData | undefined): InfiniteRecipeData | undefined => {
      if (!prev?.pages?.length) {
        return {
          pages: [{ recipes: [recipe], total: 1, nextCursor: null }],
          pageParams: [0],
        };
      }

      const firstPage = prev.pages[0];
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
                  updatedAt: updatedRecipe.updatedAt,
                }
              : r
          ),
        })),
      };
    });
  };

  // Helper to remove a recipe from the list
  const removeRecipeFromList = (id: string) => {
    setAllRecipesData((prev: InfiniteRecipeData | undefined): InfiniteRecipeData | undefined => {
      if (!prev?.pages) return prev;

      // Check if recipe exists in any page before modifying
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

  // onCreated - Manual recipe creation
  useSubscription(
    trpc.recipes.onCreated.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ recipeId: payload.recipe.id }, "[onCreated] Received");
        removePendingRecipe(payload.recipe.id);
        addRecipeToList(payload.recipe);
      },
      onError: (err) => log.error({ err }, "[onCreated] Error"),
    })
  );

  // onImportStarted - Show skeleton for pending import (cross-device sync)
  useSubscription(
    trpc.recipes.onImportStarted.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ recipeId: payload.recipeId, url: payload.url }, "[onImportStarted] Received");
        addPendingRecipe(payload.recipeId);
      },
      onError: (err) => log.error({ err }, "[onImportStarted] Error"),
    })
  );

  // onImported - Recipe imported from URL
  useSubscription(
    trpc.recipes.onImported.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info(
          { recipeId: payload.recipe.id, pendingRecipeId: payload.pendingRecipeId },
          "[onImported] Received"
        );
        // Remove pending skeleton - use pendingRecipeId if provided (duplicate case),
        // otherwise use the recipe id
        const pendingId = payload.pendingRecipeId ?? payload.recipe.id;

        removePendingRecipe(pendingId);
        addRecipeToList(payload.recipe);

        addToast({
          severity: "success",
          title: "Recipe imported",
          description: "Open recipe",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
          classNames: {
            closeButton: "opacity-100 absolute right-4 top-1/2 -translate-y-1/2",
          },
          endContent: (
            <Link href={`/recipes/${payload.recipe.id}`}>
              <Button color="primary" radius="full" size="sm" variant="solid">
                Open
              </Button>
            </Link>
          ),
        });
      },
      onError: (err) => log.error({ err }, "[onImported] Error"),
    })
  );

  // onUpdated - Recipe updated
  useSubscription(
    trpc.recipes.onUpdated.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ recipeId: payload.recipe.id }, "[onUpdated] Received");
        updateRecipeInList(payload.recipe);
        // Also invalidate the single recipe query if it's cached
        queryClient.invalidateQueries({
          queryKey: [["recipes", "get"], { input: { id: payload.recipe.id }, type: "query" }],
        });

        queryClient.invalidateQueries({ queryKey: [["calendar", "listRecipes"]] });
      },
      onError: (err) => log.error({ err }, "[onUpdated] Error"),
    })
  );

  // onDeleted - Recipe deleted
  useSubscription(
    trpc.recipes.onDeleted.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ recipeId: payload.id }, "[onDeleted] Received");
        removeRecipeFromList(payload.id);
        // Also invalidate the single recipe query if it's cached
        queryClient.invalidateQueries({
          queryKey: [["recipes", "get"], { input: { id: payload.id }, type: "query" }],
        });
      },
      onError: (err) => log.error({ err }, "[onDeleted] Error"),
    })
  );

  // onConverted - Recipe measurements converted
  useSubscription(
    trpc.recipes.onConverted.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ recipeId: payload.recipe.id }, "[onConverted] Received");
        updateRecipeInList(payload.recipe);
        // Also invalidate the single recipe query if it's cached
        queryClient.invalidateQueries({
          queryKey: [["recipes", "get"], { input: { id: payload.recipe.id }, type: "query" }],
        });

        addToast({
          severity: "success",
          title: "Measurements converted",
          description: `Recipe converted to ${payload.recipe.systemUsed} units`,
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
      },
      onError: (err) => log.error({ err }, "[onConverted] Error"),
    })
  );

  // onFailed - Operation failed
  useSubscription(
    trpc.recipes.onFailed.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ reason: payload.reason, recipeId: payload.recipeId }, "[onFailed] Received");
        // Remove from pending if it was a pending recipe
        if (payload.recipeId) {
          removePendingRecipe(payload.recipeId);
        }

        // Invalidate to get correct state
        invalidate();

        addToast({
          severity: "danger",
          title: "Recipe operation failed",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
          description: payload.reason,
          classNames: {
            closeButton: "opacity-100 absolute right-4 top-1/2 -translate-y-1/2",
          },
        });
      },
      onError: (err) => log.error({ err }, "[onFailed] Error"),
    })
  );

  // onRecipeBatchCreated - Bulk recipe creation (archive imports)
  useSubscription(
    trpc.recipes.onRecipeBatchCreated.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ count: payload.recipes.length }, "[onRecipeBatchCreated] Received");
        if (payload.recipes.length === 0) return;

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
            const existingIds = new Set(firstPage.recipes.map((r) => r.id));
            const newRecipes = payload.recipes.filter((r) => !existingIds.has(r.id));

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
      onError: (err) => log.error({ err }, "[onRecipeBatchCreated] Error"),
    })
  );
}
