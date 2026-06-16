import type { TypedRedisEmitter } from "@norish/shared-server/redis/pubsub";
import type {
  ArchiveCompletedPayload,
  ArchiveProgressPayload,
  FullRecipeDTO,
  RecipeDashboardDTO,
} from "@norish/shared/contracts";
import type { RecipeShareLifecycleEventDto } from "@norish/shared/contracts/dto/recipe-shares";
import { createTypedEmitter } from "@norish/shared-server/redis/pubsub";

export type RecipeSubscriptionEvents = {
  created: { recipe: RecipeDashboardDTO };
  importStarted: { recipeId: string; url: string };
  imported: {
    recipe: RecipeDashboardDTO;
    pendingRecipeId?: string;
    toast?: "imported";
  };
  shareCreated: RecipeShareLifecycleEventDto;
  shareUpdated: RecipeShareLifecycleEventDto;
  shareRevoked: RecipeShareLifecycleEventDto;
  shareReactivated: RecipeShareLifecycleEventDto;
  shareDeleted: RecipeShareLifecycleEventDto;
  updated: { recipe: FullRecipeDTO };
  deleted: { id: string };
  converted: { recipe: FullRecipeDTO };
  failed: { reason: string; recipeId?: string; url?: string };
  nutritionStarted: { recipeId: string };
  autoTaggingStarted: { recipeId: string };
  autoTaggingCompleted: { recipeId: string };
  autoCategorizationStarted: { recipeId: string };
  autoCategorizationCompleted: { recipeId: string };
  allergyDetectionStarted: { recipeId: string };
  allergyDetectionCompleted: { recipeId: string };
  processingToast: {
    recipeId: string;
    titleKey: string;
    severity: "default" | "success";
  };
  recipeBatchCreated: { recipes: RecipeDashboardDTO[] };
  archiveProgress: ArchiveProgressPayload;
  archiveCompleted: ArchiveCompletedPayload;
};

declare global {
  var __recipeEmitter__: TypedRedisEmitter<RecipeSubscriptionEvents> | undefined;
}

export const recipeEmitter: TypedRedisEmitter<RecipeSubscriptionEvents> =
  globalThis.__recipeEmitter__ ||
  (globalThis.__recipeEmitter__ = createTypedEmitter<RecipeSubscriptionEvents>("recipe"));
