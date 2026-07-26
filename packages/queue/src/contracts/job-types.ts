import type { Job } from "bullmq";

import type {
  RecipeEnrichmentKind,
  RecipeEnrichmentOrigin,
} from "@norish/shared/lib/recipe-enrichment";

export interface RecipeImportJobData {
  url: string;
  recipeId: string;
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
  forceAI?: boolean;
}

export type AddImportJobResult =
  | { status: "queued"; job: Job<RecipeImportJobData> }
  | { status: "exists"; existingRecipeId: string }
  | { status: "duplicate"; existingJobId: string };

export type CaldavSyncOperation = "sync" | "delete";

export interface CaldavSyncJobData {
  userId: string;
  itemId: string;
  itemType: "recipe" | "note";
  plannedItemId: string | null;
  eventTitle: string;
  date: string;
  slot: string;
  recipeId?: string;
  operation: CaldavSyncOperation;
  caldavServerUrl: string;
}

export interface ImageImportFile {
  data: string;
  mimeType: string;
  filename: string;
}

export interface ImageImportJobData {
  recipeId: string;
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
  files: ImageImportFile[];
}

export type AddImageImportJobResult =
  | { status: "queued"; job: Job<ImageImportJobData> }
  | { status: "duplicate"; existingJobId: string };

export interface PasteImportJobData {
  batchId: string;
  recipeIds: string[];
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
  text: string;
  forceAI?: boolean;
  structuredRecipes?: StructuredPasteImportRecipe[];
}

export interface StructuredPasteImportRecipe {
  recipeId: string;
  recipe: import("@norish/shared/contracts").FullRecipeInsertDTO;
  importedRating: number | null;
}

export interface PasteImportJobResult {
  recipeIds: string[];
}

export type AddPasteImportJobResult =
  | { status: "queued"; job: Job<PasteImportJobData, PasteImportJobResult> }
  | { status: "duplicate"; existingJobId: string };

/**
 * One job shape for all four Recipe Enrichment kinds.
 *
 * The queues stay independent so a slow kind cannot serialize the others, but
 * they share this contract because clients need one lifecycle story, not four.
 */
export interface RecipeEnrichmentJobData {
  recipeId: string;
  kind: RecipeEnrichmentKind;
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
  origin: RecipeEnrichmentOrigin;
  /** Set for manual runs only, so a terminal failure reaches the requester alone. */
  requestedByUserId?: string;
}
