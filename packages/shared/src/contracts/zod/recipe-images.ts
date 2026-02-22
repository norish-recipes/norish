import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { recipeImages } from "@/server/db/schema";

export const RecipeImageSelectSchema = createSelectSchema(recipeImages);
export const RecipeImageInsertSchema = createInsertSchema(recipeImages).omit({
  id: true,
  createdAt: true,
});

export const RecipeImageSchema = z.object({
  id: z.uuid().optional(),
  image: z.string(),
  order: z.coerce.number().default(0),
});

export const RecipeImageInputSchema = z.object({
  image: z.string(),
  order: z.coerce.number().default(0),
});

// Max 10 images per recipe
export const MAX_RECIPE_IMAGES = 10;

export const RecipeImagesArraySchema = z.array(RecipeImageSchema).max(MAX_RECIPE_IMAGES);
export const RecipeImagesInputArraySchema = z.array(RecipeImageInputSchema).max(MAX_RECIPE_IMAGES);
