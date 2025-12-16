import { z } from "zod";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";

import { TagNameSchema } from "./tag";
import {
  RecipeIngredientInputSchema,
  RecipeIngredientsWithoutIdSchema,
} from "./recipe-ingredients";
import { StepStepSchema } from "./steps";

import { measurementSystemEnum, recipes } from "@/server/db/schema";

export const RecipeSelectBaseSchema = createSelectSchema(recipes).extend({
  userId: z.string().nullable(),
});
export const RecipeInsertBaseSchema = createInsertSchema(recipes).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
  userId: true, // set from session server-side
});
export const RecipeUpdateBaseSchema = createUpdateSchema(recipes);

export const AuthorSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
  })
  .optional();

export const RecipeDashboardSchema = RecipeSelectBaseSchema.omit({
  systemUsed: true,
}).extend({
  tags: z.array(TagNameSchema).default([]),
  author: AuthorSchema,
  averageRating: z.number().nullable().optional(),
  ratingCount: z.number().optional(),
});

export const FullRecipeSchema = RecipeSelectBaseSchema.extend({
  recipeIngredients: z.array(RecipeIngredientsWithoutIdSchema),
  steps: z.array(StepStepSchema).default([]),
  tags: z.array(TagNameSchema).default([]),
  author: AuthorSchema,
});

export const FullRecipeInsertSchema = RecipeInsertBaseSchema.extend({
  id: z.uuid().optional(),
  recipeIngredients: z.array(RecipeIngredientInputSchema).default([]),
  tags: z.array(TagNameSchema).default([]),
  steps: z.array(StepStepSchema).default([]),
});

export const FullRecipeUpdateSchema = RecipeUpdateBaseSchema.extend({
  recipeIngredients: z.array(RecipeIngredientInputSchema.partial()).optional(),
  tags: z.array(TagNameSchema).optional(),
  steps: z.array(StepStepSchema).optional(),
});

export const measurementSystems = measurementSystemEnum.enumValues;

// tRPC input schemas
export const RecipeListInputSchema = z.object({
  cursor: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  filterMode: z.enum(["AND", "OR"]).default("OR"),
  sortMode: z.enum(["titleAsc", "titleDesc", "dateAsc", "dateDesc"]).default("dateDesc"),
  minRating: z.number().min(1).max(5).optional(),
});

export const RecipeGetInputSchema = z.object({
  id: z.uuid(),
});

export const RecipeDeleteInputSchema = z.object({
  id: z.uuid(),
});

export const RecipeImportInputSchema = z.object({
  url: z.url(),
});

export const RecipeConvertInputSchema = z.object({
  recipeId: z.uuid(),
  targetSystem: z.enum(["metric", "us"]),
});

export const RecipeUpdateInputSchema = z.object({
  id: z.uuid(),
  data: FullRecipeUpdateSchema,
});
