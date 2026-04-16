import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { recipeVideos } from "@norish/db/schema";

/** Maximum number of videos allowed per recipe */
export const MAX_RECIPE_VIDEOS = 5;

export const RecipeVideoSelectSchema = createSelectSchema(recipeVideos);
export const RecipeVideoInsertSchema = createInsertSchema(recipeVideos).omit({
  id: true,
  createdAt: true,
});

export const RecipeVideoOutputSchema = z.object({
  id: z.string().uuid(),
  video: z.string(),
  thumbnail: z.string().nullish(),
  duration: z.coerce.number().nullish(),
  order: z.coerce.number().default(0),
  version: z.number(),
});

export const RecipeVideoSchema = z.object({
  id: z.string().uuid().optional(),
  video: z.string(),
  thumbnail: z.string().nullish(),
  duration: z.coerce.number().nullish(),
  order: z.coerce.number().default(0),
  version: z.number().int().positive().optional(),
});

export const RecipeVideoInputSchema = z.object({
  video: z.string(),
  thumbnail: z.string().nullish(),
  duration: z.coerce.number().nullish(),
  order: z.coerce.number().default(0),
});

export const DeleteRecipeVideoInputSchema = z.object({
  videoId: z.string().uuid(),
  version: z.number().int().positive(),
});

export const RecipeVideosArraySchema = z.array(RecipeVideoOutputSchema);
export const RecipeVideosInputArraySchema = z.array(RecipeVideoInputSchema);
