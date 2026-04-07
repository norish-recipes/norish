import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { measurementSystemEnum, recipes } from "@norish/db/schema";

import { RecipeImagesArraySchema, RecipeImageSchema } from "./recipe-images";
import {
  RecipeIngredientInputBaseSchema,
  RecipeIngredientInputSchema,
  RecipeIngredientsWithIdSchema,
} from "./recipe-ingredients";
import { RecipeVideosArraySchema, RecipeVideoSchema } from "./recipe-videos";
import { StepOutputSchema, StepStepSchema } from "./steps";
import { TagNameSchema, TagSummarySchema } from "./tag";

export const recipeCategorySchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);

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
    version: z.number().int().positive(),
  })
  .optional();

export const RecipeDashboardSchema = RecipeSelectBaseSchema.omit({
  systemUsed: true,
  fat: true,
  carbs: true,
  protein: true,
}).extend({
  tags: z.array(TagSummarySchema).default([]),
  categories: z.array(recipeCategorySchema).default([]),
  author: AuthorSchema,
  averageRating: z.number().nullable().optional(),
  ratingCount: z.number().optional(),
});

export const FullRecipeSchema = RecipeSelectBaseSchema.extend({
  recipeIngredients: z.array(RecipeIngredientsWithIdSchema),
  steps: z.array(StepOutputSchema).default([]),
  tags: z.array(TagSummarySchema).default([]),
  categories: z.array(recipeCategorySchema).default([]),
  author: AuthorSchema,
  images: RecipeImagesArraySchema.default([]),
  videos: RecipeVideosArraySchema.default([]),
});

export const FullRecipeInsertSchema = RecipeInsertBaseSchema.extend({
  id: z.uuid().optional(),
  recipeIngredients: z.array(RecipeIngredientInputSchema).default([]),
  tags: z.array(TagNameSchema).default([]),
  categories: z.array(recipeCategorySchema).default([]),
  steps: z.array(StepStepSchema).default([]),
  images: z.array(RecipeImageSchema).max(10).default([]),
  videos: z.array(RecipeVideoSchema).default([]),
});

export const FullRecipeUpdateSchema = RecipeUpdateBaseSchema.extend({
  recipeIngredients: z.array(RecipeIngredientInputBaseSchema.partial()).optional(),
  tags: z.array(TagNameSchema).optional(),
  steps: z.array(StepStepSchema).optional(),
  images: z.array(RecipeImageSchema).max(10).optional(),
  videos: z.array(RecipeVideoSchema).optional(),
});

export const measurementSystems = measurementSystemEnum.enumValues;

// tRPC input schemas
export const RecipeListInputSchema = z.object({
  cursor: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe("Zero-based pagination offset. Defaults to 0."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Maximum number of recipes to return. Defaults to 50."),
  search: z.string().optional().describe("Optional free-text search term."),
  searchFields: z
    .array(z.enum(["title", "description", "ingredients", "steps", "tags"]))
    .default(["title", "ingredients"])
    .describe("Fields searched when `search` is provided. Defaults to `title` and `ingredients`."),
  tags: z.array(z.string()).optional().describe("Optional tag filter."),
  categories: z
    .array(z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]))
    .optional()
    .describe("Optional meal category filter."),
  filterMode: z
    .enum(["AND", "OR"])
    .default("OR")
    .describe("How multi-value filters are combined. Defaults to `OR`."),
  sortMode: z
    .enum(["titleAsc", "titleDesc", "dateAsc", "dateDesc", "none"])
    .default("dateDesc")
    .describe("Sort order for the returned recipes. Defaults to `dateDesc`."),
  minRating: z.number().min(1).max(5).optional().describe("Optional minimum recipe rating."),
  maxCookingTime: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Optional maximum cooking time in minutes."),
});

export const RecipeListResultSchema = z.object({
  recipes: z.array(RecipeDashboardSchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.number().int().nonnegative().nullable(),
});

export const RecipeGetInputSchema = z.object({
  id: z.uuid(),
});

export const RecipeDeleteInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
});

export const RecipeImportInputSchema = z.object({
  url: z.url(),
});

export const RecipeConvertInputSchema = z.object({
  recipeId: z.uuid(),
  targetSystem: z.enum(["metric", "us"]),
  version: z.number().int().positive(),
});

export const RecipeUpdateInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  data: FullRecipeUpdateSchema,
});

// Image import schemas
export const OcrImportFileSchema = z.object({
  data: z.string(), // base64 encoded
  mimeType: z.string(),
  filename: z.string(),
});

export const RecipeImageImportInputSchema = z.object({
  files: z.array(OcrImportFileSchema).min(1).max(10),
});

export const RecipeImportResultSchema = z.object({
  recipeId: z.uuid(),
  status: z.enum(["queued", "exists"]),
  recipe: RecipeDashboardSchema.nullable().optional(),
});
