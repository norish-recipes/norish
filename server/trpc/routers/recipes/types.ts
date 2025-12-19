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
  imported: { recipe: RecipeDashboardDTO; pendingRecipeId?: string };
  updated: { recipe: FullRecipeDTO };
  deleted: { id: string };
  converted: { recipe: FullRecipeDTO };
  failed: { reason: string; recipeId?: string; url?: string };

  // Nutrition estimation events
  nutritionStarted: { recipeId: string };

  // Batch recipe creation (for archive imports)
  recipeBatchCreated: { recipes: RecipeDashboardDTO[] };

  // Archive import events (user-scoped, emitted via recipe emitter)
  archiveProgress: ArchiveProgressPayload;
  archiveCompleted: ArchiveCompletedPayload;
};
