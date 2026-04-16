import { z } from "zod";

export const FavoriteSetInputSchema = z.object({
  recipeId: z.uuid(),
  isFavorite: z.boolean(),
  version: z.number().int().positive().optional(),
});

export const FavoriteToggleInputSchema = FavoriteSetInputSchema;

export const FavoriteCheckInputSchema = z.object({
  recipeId: z.uuid(),
});

export const FavoriteBatchCheckInputSchema = z.object({
  recipeIds: z.array(z.uuid()),
});
