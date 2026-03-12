import type { RecipesSubscriptionCallbacks } from "../../hooks/recipes/dashboard";

export type RecipeToastSeverity = "default" | "success" | "warning" | "danger";

export type RecipeToastAdapter = {
  show: (toast: {
    severity: RecipeToastSeverity;
    title: string;
    description?: string;
    actionLabel?: string;
    onActionPress?: () => void;
  }) => void;
};

function readMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const candidate = payload as Record<string, unknown>;

  if (typeof candidate.message === "string") return candidate.message;
  if (typeof candidate.description === "string") return candidate.description;

  return undefined;
}

export function createRecipeImportToasts(adapter: RecipeToastAdapter) {
  return {
    showImportRecipePending() {
      adapter.show({
        severity: "default",
        title: "Importing recipe...",
        description: "Import in progress, please wait...",
      });
    },
    showImportRecipeWithAIPending() {
      adapter.show({
        severity: "default",
        title: "Importing recipe with AI...",
        description: "Import in progress, please wait...",
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
        title: "Recipe imported",
        actionLabel: recipeId ? "View" : undefined,
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
        title: "Recipe updated",
      });
    },
    onFailed: (payload) => {
      adapter.show({
        severity: "danger",
        title: "Recipe processing failed",
        description: readMessage(payload) ?? "Please try again.",
      });
    },
    onProcessingToast: (payload) => {
      const message = readMessage(payload);

      if (!message) return;

      adapter.show({
        severity: "default",
        title: message,
      });
    },
  };
}
