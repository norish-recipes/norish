import type {
  RatingsSubscriptionCallbacks,
  RecipesSubscriptionCallbacks,
} from "../../hooks/recipes/dashboard";
import type { ToastAdapter, ToastSeverity } from "../toast-adapter";
import { readProcessingToastPayload, readToastMessage } from "../toast-adapter";

export type RecipeToastSeverity = ToastSeverity;
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
        severity: "success",
        title: adapter.translate("recipes.toasts.imported"),
        actionLabel: recipeId ? adapter.translate("recipes.toasts.view") : undefined,
        onActionPress:
          recipeId && options?.onOpenRecipe
            ? () => {
                options.onOpenRecipe?.(recipeId);
              }
            : undefined,
      });
    },
    onConverted: () => {
      adapter.show({
        severity: "success",
        title: adapter.translate("recipes.toasts.converted"),
      });
    },
    onFailed: (payload) => {
      adapter.show({
        severity: "danger",
        title: adapter.translate("recipes.toasts.failed"),
        description:
          readToastMessage(payload) ?? adapter.translate("recipes.toasts.failedDescription"),
      });
    },
    onProcessingToast: (payload) => {
      const message = readToastMessage(payload);
      const processingToast = readProcessingToastPayload(payload);
      const title = processingToast?.titleKey
        ? adapter.translate(`recipes.toasts.${processingToast.titleKey}`)
        : message;

      if (!title) return;

      adapter.show({
        severity: processingToast?.severity ?? "default",
        title,
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
