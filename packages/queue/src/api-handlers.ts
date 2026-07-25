import type { AIResult } from "@norish/shared-server/ai/types/result";
import type { RecipeCategory, Slot } from "@norish/shared/contracts";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";

import type { ImageImportFile } from "./contracts/job-types";

export interface QueueParseRecipeResult {
  recipe: FullRecipeInsertDTO;
  usedAI: boolean;
}

export interface QueueNutritionEstimate {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

export interface QueueRecipeSummary {
  title: string;
  description: string | null;
  ingredients: string[];
}

export interface QueueSyncResult {
  uid: string;
  isNew: boolean;
}

export interface QueueMediaCleanupResult {
  deleted: number;
  errors: number;
}

export interface QueueApiHandlers {
  extractRecipeNodesFromJsonValue(input: unknown): Record<string, unknown>[];
  normalizeRecipeFromJson(json: unknown, recipeId: string): Promise<FullRecipeInsertDTO | null>;
  parseCategories(recipeCategory: unknown): RecipeCategory[];
  parseTags(keywords: unknown): { name: string }[];
  extractRecipeWithAI(
    html: string,
    recipeId: string,
    url?: string,
    allergies?: string[],
    originalHtml?: string
  ): Promise<AIResult<FullRecipeInsertDTO>>;
  parseRecipeFromUrl(
    url: string,
    recipeId: string,
    allergies?: string[],
    forceAI?: boolean,
    tokens?: SiteAuthTokenDecryptedDto[]
  ): Promise<QueueParseRecipeResult>;
  extractRecipeFromImages(
    recipeId: string,
    files: ImageImportFile[],
    allergies?: string[]
  ): Promise<AIResult<FullRecipeInsertDTO>>;
  estimateNutritionFromIngredients(
    recipeName: string,
    servings: number,
    ingredients: Array<{
      ingredientName: string;
      amount: number | null;
      unit: string | null;
    }>
  ): Promise<AIResult<QueueNutritionEstimate>>;
  generateTagsForRecipe(recipe: QueueRecipeSummary): Promise<AIResult<string[]>>;
  categorizeRecipe(recipe: QueueRecipeSummary): Promise<AIResult<RecipeCategory[]>>;
  detectAllergiesInRecipe(
    recipe: QueueRecipeSummary,
    allergiesToDetect: string[]
  ): Promise<AIResult<string[]>>;
  syncPlannedItem(
    userId: string,
    itemId: string,
    eventTitle: string,
    date: string,
    slot: Slot,
    recipeId?: string
  ): Promise<QueueSyncResult>;
  deletePlannedItem(userId: string, itemId: string): Promise<void>;
  truncateErrorMessage(error: string): string;
  cleanupOrphanedImages(): Promise<QueueMediaCleanupResult>;
  cleanupOrphanedAvatars(): Promise<QueueMediaCleanupResult>;
  cleanupOrphanedStepImages(): Promise<QueueMediaCleanupResult>;
  cleanupOldTempFiles(maxAgeMs?: number): Promise<void>;
}

const globalForQueueApiHandlers = globalThis as typeof globalThis & {
  __norishQueueApiHandlers__?: Partial<QueueApiHandlers>;
};

function getRegisteredHandlers(): Partial<QueueApiHandlers> {
  if (!globalForQueueApiHandlers.__norishQueueApiHandlers__) {
    globalForQueueApiHandlers.__norishQueueApiHandlers__ = {};
  }

  return globalForQueueApiHandlers.__norishQueueApiHandlers__;
}

export function registerQueueApiHandlers(handlers: Partial<QueueApiHandlers>): void {
  globalForQueueApiHandlers.__norishQueueApiHandlers__ = {
    ...getRegisteredHandlers(),
    ...handlers,
  };
}

export function requireQueueApiHandler<K extends keyof QueueApiHandlers>(
  name: K
): QueueApiHandlers[K] {
  const handler = getRegisteredHandlers()[name];

  if (!handler) {
    throw new Error(`Queue API handler not registered: ${String(name)}`);
  }

  return handler as QueueApiHandlers[K];
}

export function resetQueueApiHandlersForTests(): void {
  globalForQueueApiHandlers.__norishQueueApiHandlers__ = {};
}
