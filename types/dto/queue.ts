import type { Job } from "bullmq";

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

export interface PendingRecipeDTO {
  recipeId: string;
  url: string;
  addedAt: number;
}

// CalDav sync queue types
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
  /** sync = create or update, delete = remove from CalDAV */
  operation: CaldavSyncOperation;
  /** CalDAV server URL for job deduplication */
  caldavServerUrl: string;
}

// Image import queue types
export interface ImageImportFile {
  data: string; // base64 encoded
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

export interface PendingImageImportDTO {
  recipeId: string;
  fileCount: number;
  addedAt: number;
}

// Paste import queue types
export interface PasteImportJobData {
  recipeId: string;
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
  text: string;
  forceAI?: boolean;
}

export type AddPasteImportJobResult =
  | { status: "queued"; job: Job<PasteImportJobData> }
  | { status: "duplicate"; existingJobId: string };

// Nutrition estimation queue types
export interface NutritionEstimationJobData {
  recipeId: string;
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
}

export type AddNutritionEstimationJobResult =
  | { status: "queued"; job: Job<NutritionEstimationJobData> }
  | { status: "duplicate"; existingJobId: string };
