import type { Job } from "bullmq";

export interface RecipeImportJobData {
  url: string;
  recipeId: string;
  userId: string;
  householdKey: string;
  /** User IDs in the household (for policy-aware checks) */
  householdUserIds: string[] | null;
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
