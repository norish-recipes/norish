"use client";

import type { RecipeDashboardDTO, FullRecipeDTO } from "@/types";

import { useSubscription } from "@trpc/tanstack-react-query";
import { useQueryClient } from "@tanstack/react-query";
import { addToast, Button } from "@heroui/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useRecipesCacheHelpers, type InfiniteRecipeData } from "./use-recipes-cache";

import { useTRPC } from "@/app/providers/trpc-provider";
import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("recipes-subscription");

/**
 * Hook that subscribes to all recipe-related WebSocket events
 * and updates the query cache accordingly.
 *
 * Uses useRecipesCacheHelpers internally to get cache manipulation functions
 * WITHOUT creating query observers - this prevents the recursion issue.
 */
export function useRecipesSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations("recipes.toasts");

  // Get cache helpers - these don't create query observers, so no recursion
  const {
    setAllRecipesData,
    invalidate,
    addPendingRecipe,
    removePendingRecipe,
    addAutoTaggingRecipe,
    removeAutoTaggingRecipe,
    addAllergyDetectionRecipe,
    removeAllergyDetectionRecipe,
  } = useRecipesCacheHelpers();

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
        const pendingId = payload.pendingRecipeId ?? payload.recipe.id;

        removePendingRecipe(pendingId);
        addRecipeToList(payload.recipe);

        if (payload.toast === "imported") {
          addToast({
            severity: "success",
            title: t("imported"),
            shouldShowTimeoutProgress: true,
            radius: "full",
            classNames: {
              closeButton: "opacity-100 absolute right-4 top-1/2 -translate-y-1/2",
            },
            endContent: (
              <Link href={`/recipes/${payload.recipe.id}`}>
                <Button color="primary" radius="full" size="sm" variant="solid">
                  {t("open")}
                </Button>
              </Link>
            ),
          });
        }
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
        queryClient.invalidateQueries({
          queryKey: [["recipes", "get"], { input: { id: payload.recipe.id }, type: "query" }],
        });

        addToast({
          severity: "success",
          title: t("converted"),
          description: t("convertedDescription", { system: payload.recipe.systemUsed }),
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
        if (payload.recipeId) {
          removePendingRecipe(payload.recipeId);
          removeAutoTaggingRecipe(payload.recipeId);
          removeAllergyDetectionRecipe(payload.recipeId);
        }

        invalidate();

        addToast({
          severity: "danger",
          title: t("failed"),
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

  // onAutoTaggingStarted
  useSubscription(
    trpc.recipes.onAutoTaggingStarted.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ recipeId: payload.recipeId }, "[onAutoTaggingStarted] Received");
        addAutoTaggingRecipe(payload.recipeId);
      },
      onError: (err) => log.error({ err }, "[onAutoTaggingStarted] Error"),
    })
  );

  // onAllergyDetectionStarted
  useSubscription(
    trpc.recipes.onAllergyDetectionStarted.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ recipeId: payload.recipeId }, "[onAllergyDetectionStarted] Received");
        addAllergyDetectionRecipe(payload.recipeId);
      },
      onError: (err) => log.error({ err }, "[onAllergyDetectionStarted] Error"),
    })
  );

  // onAutoTaggingCompleted
  useSubscription(
    trpc.recipes.onAutoTaggingCompleted.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ recipeId: payload.recipeId }, "[onAutoTaggingCompleted] Received");
        removeAutoTaggingRecipe(payload.recipeId);
      },
      onError: (err) => log.error({ err }, "[onAutoTaggingCompleted] Error"),
    })
  );

  // onAllergyDetectionCompleted
  useSubscription(
    trpc.recipes.onAllergyDetectionCompleted.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ recipeId: payload.recipeId }, "[onAllergyDetectionCompleted] Received");
        removeAllergyDetectionRecipe(payload.recipeId);
      },
      onError: (err) => log.error({ err }, "[onAllergyDetectionCompleted] Error"),
    })
  );

  // onProcessingToast
  useSubscription(
    trpc.recipes.onProcessingToast.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info(
          { recipeId: payload.recipeId, titleKey: payload.titleKey },
          "[onProcessingToast] Received"
        );
        addToast({
          severity: payload.severity,
          title: t(payload.titleKey),
          timeout: payload.severity === "success" ? 2000 : 3000,
          shouldShowTimeoutProgress: true,
          radius: "full",
          classNames: {
            closeButton: "opacity-100 absolute right-4 top-1/2 -translate-y-1/2",
          },
          endContent: (
            <Link href={`/recipes/${payload.recipeId}`}>
              <Button color="primary" radius="full" size="sm" variant="solid">
                {t("open")}
              </Button>
            </Link>
          ),
        });
      },
      onError: (err) => log.error({ err }, "[onProcessingToast] Error"),
    })
  );

  // onRecipeBatchCreated
  useSubscription(
    trpc.recipes.onRecipeBatchCreated.subscriptionOptions(undefined, {
      onData: (payload) => {
        log.info({ count: payload.recipes.length }, "[onRecipeBatchCreated] Received");

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
