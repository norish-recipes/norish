"use client";

import {
  NOT_A_RECIPE_REASON,
  PRIVATE_ADDRESS_REASON,
} from "@norish/shared/contracts/realtime/recipes";

import type { ToastAdapter } from "../platform/platform";
import type {
  RecipeImportsSubscriptionCallbacks,
  RecipeListSubscriptionCallbacks,
} from "./use-recipes-subscription";
import { usePlatform } from "../platform/platform";
import { useRatingsSubscription } from "./use-ratings-subscription";
import {
  useRecipeImportsSubscription,
  useRecipeListSubscription,
} from "./use-recipes-subscription";

/** The server reasons a person can act on, each with its translation. */
const TRANSLATED_REASONS: Record<string, string> = {
  [NOT_A_RECIPE_REASON]: "recipes.toasts.notARecipe",
  [PRIVATE_ADDRESS_REASON]: "recipes.toasts.privateAddress",
};

function readToastMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const candidate = payload as Record<string, unknown>;

  if (typeof candidate.message === "string") return candidate.message;
  if (typeof candidate.description === "string") return candidate.description;

  return undefined;
}

export function createRecipeSubscriptionToasts(
  adapter: ToastAdapter,
  options?: { onOpenRecipe?: (recipeId: string) => void }
): RecipeImportsSubscriptionCallbacks & RecipeListSubscriptionCallbacks {
  return {
    onImported: (payload) => {
      const recipeId =
        payload && typeof payload === "object" && "recipe" in payload
          ? ((payload as { recipe?: { id?: string } }).recipe?.id ?? null)
          : null;

      adapter.show({
        severity: payload.incomplete ? "warning" : "success",
        title: adapter.translate("recipes.toasts.imported"),
        description: payload.incomplete
          ? adapter.translate("recipes.toasts.incomplete")
          : undefined,
        actionLabel: recipeId ? adapter.translate("recipes.toasts.view") : undefined,
        onActionPress:
          recipeId && options?.onOpenRecipe
            ? () => {
                options.onOpenRecipe?.(recipeId);
              }
            : undefined,
      });
    },
    onFailed: (payload) => {
      const reasonKey = payload.reason ? TRANSLATED_REASONS[payload.reason] : undefined;

      adapter.show({
        severity: "danger",
        title: adapter.translate("recipes.toasts.failed"),
        // Server reasons stay in the job monitor; the ones a person can act on are translated.
        description: reasonKey
          ? adapter.translate(reasonKey)
          : (readToastMessage(payload) ?? adapter.translate("recipes.toasts.failedDescription")),
      });
    },
    onDeleteKept: ({ ids }) => {
      adapter.show({
        severity: "warning",
        title: adapter.translate("recipes.toasts.deleteKept", { count: ids.length }),
      });
    },
  };
}

/** The import outcomes and their toasts. The shell mounts them: an import starts on any page. */
export function useRecipeImportOutcomes() {
  const { toast, navigation } = usePlatform();

  useRecipeImportsSubscription(
    createRecipeSubscriptionToasts(toast, { onOpenRecipe: navigation.toRecipe })
  );
}

/** What a Library page draws and keeps current: the recipe list events and ratings. */
export function useLibrarySubscriptions() {
  const { toast } = usePlatform();

  useRecipeListSubscription(createRecipeSubscriptionToasts(toast));
  useRatingsSubscription();
}
