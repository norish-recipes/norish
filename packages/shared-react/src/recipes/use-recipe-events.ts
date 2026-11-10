"use client";

import {
  NOT_A_RECIPE_REASON,
  PRIVATE_ADDRESS_REASON,
} from "@norish/shared/contracts/realtime/recipes";

import type { ToastAdapter } from "../platform/platform";
import type { RecipeOutcomesSubscriptionCallbacks } from "./use-recipes-subscription";
import { usePlatform } from "../platform/platform";
import { useRatingsSubscription } from "./use-ratings-subscription";
import {
  useRecipeListSubscription,
  useRecipeOutcomesSubscription,
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

export function createRecipeOutcomeToasts(
  adapter: ToastAdapter,
  options?: { onOpenRecipe?: (recipeId: string) => void }
): RecipeOutcomesSubscriptionCallbacks {
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

/** Import and delete outcomes with their toasts. The shell mounts them: both start on any page. */
export function useRecipeOutcomes() {
  const { toast, navigation } = usePlatform();

  useRecipeOutcomesSubscription(
    createRecipeOutcomeToasts(toast, { onOpenRecipe: navigation.toRecipe })
  );
}

/** What a Library page draws and keeps current: the recipe list events and ratings. */
export function useLibrarySubscriptions() {
  useRecipeListSubscription();
  useRatingsSubscription();
}
