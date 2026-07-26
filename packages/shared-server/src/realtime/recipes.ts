import type { TypedRedisEmitter } from "@norish/shared-server/redis/pubsub";
import type {
  ArchiveCompletedPayload,
  ArchiveProgressPayload,
  FullRecipeDTO,
  RecipeDashboardDTO,
} from "@norish/shared/contracts";
import type { RecipeShareLifecycleEventDto } from "@norish/shared/contracts/dto/recipe-shares";
import type { RecipeEnrichmentLifecycleEventDto } from "@norish/shared/lib/recipe-enrichment";
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
  /**
   * One typed lifecycle event for every Recipe Enrichment kind and transition.
   * Replaces the per-kind started/completed pairs and the processing toasts, so
   * clients need one status implementation rather than four.
   */
  enrichment: RecipeEnrichmentLifecycleEventDto;
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
