import {
  NOT_A_RECIPE_REASON,
  PRIVATE_ADDRESS_REASON,
} from "@norish/shared/contracts/realtime/recipes";

import type {
  RatingsSubscriptionCallbacks,
  RecipesSubscriptionCallbacks,
} from "../../hooks/recipes/dashboard";
import type { ToastAdapter, ToastSeverity } from "../toast-adapter";
import { readToastMessage } from "../toast-adapter";

export type RecipeToastSeverity = ToastSeverity;

/** The server reasons a person can act on, each with its translation. */
const TRANSLATED_REASONS: Record<string, string> = {
  [NOT_A_RECIPE_REASON]: "recipes.toasts.notARecipe",
  [PRIVATE_ADDRESS_REASON]: "recipes.toasts.privateAddress",
};
export type RecipeToastAdapter = ToastAdapter;

export function createRecipeImportToasts(adapter: RecipeToastAdapter) {
  return {
    showImportRecipePending() {
      adapter.show({
        severity: "default",
        title: adapter.translate("common.import.paste.importing"),
        description: adapter.translate("common.import.paste.inProgress"),
      });
    },
    showImportRecipeWithAIPending() {
      adapter.show({
        severity: "default",
        title: adapter.translate("common.import.paste.importingWithAI"),
        description: adapter.translate("common.import.paste.inProgress"),
      });
    },
  };
}

export function createRecipeSubscriptionToasts(
  adapter: RecipeToastAdapter,
  options?: { onOpenRecipe?: (recipeId: string) => void }
): RecipesSubscriptionCallbacks {
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
  };
}

export function createRatingsSubscriptionToasts(
  adapter: RecipeToastAdapter
): RatingsSubscriptionCallbacks {
  return {
    onRatingFailed: () => {
      adapter.show({
        severity: "danger",
        title: adapter.translate("common.errors.operationFailed"),
        description: adapter.translate("common.errors.technicalDetails"),
      });
    },
  };
}
