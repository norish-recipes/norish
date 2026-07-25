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

export interface NutritionEstimationJobData {
  recipeId: string;
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
}

export type AddNutritionEstimationJobResult =
  | { status: "queued"; job: Job<NutritionEstimationJobData> }
  | { status: "duplicate"; existingJobId: string };

export interface AutoTaggingJobData {
  recipeId: string;
  userId: string;
  householdKey: string;
}

export type AddAutoTaggingJobResult =
  | { status: "queued"; job: Job<AutoTaggingJobData> }
  | { status: "duplicate"; existingJobId: string }
  | { status: "skipped"; reason: "disabled" };

export interface AutoCategorizationJobData {
  recipeId: string;
  userId: string;
  householdKey: string;
}

export type AddAutoCategorizationJobResult =
  | { status: "queued"; job: Job<AutoCategorizationJobData> }
  | { status: "duplicate"; existingJobId: string }
  | { status: "skipped"; reason: "disabled" };

export interface AllergyDetectionJobData {
  recipeId: string;
  userId: string;
  householdKey: string;
}

export type AddAllergyDetectionJobResult =
  | { status: "queued"; job: Job<AllergyDetectionJobData> }
  | { status: "duplicate"; existingJobId: string }
  | { status: "skipped"; reason: "disabled" | "no_allergies" };
