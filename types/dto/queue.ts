import type { Job } from "bullmq";

export interface RecipeImportJobData {
  url: string;
  recipeId: string;
  userId: string;
  householdKey: string;
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
