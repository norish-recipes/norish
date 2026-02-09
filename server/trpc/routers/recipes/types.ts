import type {
  RecipeDashboardDTO,
  FullRecipeDTO,
  ArchiveProgressPayload,
  ArchiveCompletedPayload,
} from "@/types";

/**
 * Recipe subscription event payloads.
 */
export type RecipeSubscriptionEvents = {
  created: { recipe: RecipeDashboardDTO };
  importStarted: { recipeId: string; url: string };
  imported: {
    recipe: RecipeDashboardDTO;
    pendingRecipeId?: string;
    /** Toast key to show - undefined means processing will follow (no toast needed) */
    toast?: "imported";
  };
  updated: { recipe: FullRecipeDTO };
  deleted: { id: string };
  converted: { recipe: FullRecipeDTO };
  failed: { reason: string; recipeId?: string; url?: string };

  // Nutrition estimation events
  nutritionStarted: { recipeId: string };

  // Auto-tagging events
  autoTaggingStarted: { recipeId: string };
  autoTaggingCompleted: { recipeId: string };

  autoCategorizationStarted: { recipeId: string };
  autoCategorizationCompleted: { recipeId: string };

  // Allergy detection events
  allergyDetectionStarted: { recipeId: string };
  allergyDetectionCompleted: { recipeId: string };

  // Processing toast events (sent directly from workers with i18n key)
  processingToast: {
    recipeId: string;
    /** i18n key from recipes.toasts namespace */
    titleKey: string;
    severity: "default" | "success";
  };

  // Batch recipe creation (for archive imports)
  recipeBatchCreated: { recipes: RecipeDashboardDTO[] };

  // Archive import events (user-scoped, emitted via recipe emitter)
  archiveProgress: ArchiveProgressPayload;
  archiveCompleted: ArchiveCompletedPayload;
};
