import { z } from "zod";

export const RatingInputSchema = z.object({
  recipeId: z.uuid(),
  rating: z.number().int().min(1).max(5),
});

export const RatingGetInputSchema = z.object({
  recipeId: z.uuid(),
});
