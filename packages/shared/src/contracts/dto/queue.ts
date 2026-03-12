export interface PendingRecipeDTO {
  recipeId: string;
  url: string;
  addedAt: number;
}

export interface PendingImageImportDTO {
  recipeId: string;
  fileCount: number;
  addedAt: number;
}
