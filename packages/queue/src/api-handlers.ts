import type { RecipeCategory, Slot } from "@norish/shared/contracts";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";

import type { ImageImportFile } from "./contracts/job-types";

export interface QueueParseRecipeResult {
  recipe: FullRecipeInsertDTO;
  usedAI: boolean;
}

export interface QueueSyncResult {
  uid: string;
  isNew: boolean;
}

export interface QueueMediaCleanupResult {
  deleted: number;
  errors: number;
}

/**
 * The api-layer operations the queue workers call without importing
 * `@norish/api` — extraction and parsing are import-pipeline features, and
 * CalDAV sync and media cleanup are server concerns. Recipe Enrichment is
 * deliberately absent: those features live in `@norish/shared-server`, which
 * the queue imports directly.
 */
export interface QueueApiHandlers {
  extractRecipeNodesFromJsonValue(input: unknown): Record<string, unknown>[];
  normalizeRecipeFromJson(json: unknown, recipeId: string): Promise<FullRecipeInsertDTO | null>;
  parseCategories(recipeCategory: unknown): RecipeCategory[];
  parseTags(keywords: unknown): { name: string }[];
  extractRecipeWithAI(
    html: string,
    recipeId: string,
    url?: string,
    originalHtml?: string
  ): Promise<FullRecipeInsertDTO>;
  parseRecipeFromUrl(
    url: string,
    recipeId: string,
    forceAI?: boolean,
    tokens?: SiteAuthTokenDecryptedDto[]
  ): Promise<QueueParseRecipeResult>;
  extractRecipeFromImages(recipeId: string, files: ImageImportFile[]): Promise<FullRecipeInsertDTO>;
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
