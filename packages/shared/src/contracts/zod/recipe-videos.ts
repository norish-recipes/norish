import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { recipeVideos } from "@/server/db/schema";

/** Maximum number of videos allowed per recipe */
export const MAX_RECIPE_VIDEOS = 5;

export const RecipeVideoSelectSchema = createSelectSchema(recipeVideos);
export const RecipeVideoInsertSchema = createInsertSchema(recipeVideos).omit({
  id: true,
  createdAt: true,
});

export const RecipeVideoSchema = z.object({
  id: z.string().uuid().optional(),
  video: z.string(),
  thumbnail: z.string().nullish(),
  duration: z.coerce.number().nullish(),
  order: z.coerce.number().default(0),
});

export const RecipeVideoInputSchema = z.object({
  video: z.string(),
  thumbnail: z.string().nullish(),
  duration: z.coerce.number().nullish(),
  order: z.coerce.number().default(0),
});

export const RecipeVideosArraySchema = z.array(RecipeVideoSchema);
export const RecipeVideosInputArraySchema = z.array(RecipeVideoInputSchema);
