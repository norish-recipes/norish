import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { recipeShares } from "@norish/db/schema/recipe-shares";

import { measurementSystems, recipeCategorySchema } from "./recipe";

export const recipeShareExpiryPolicies = ["1day", "1week", "1month", "1year", "forever"] as const;
export const recipeShareStatuses = ["active", "expired", "revoked"] as const;

export const RecipeShareSelectSchema = createSelectSchema(recipeShares);
export const RecipeShareExpiryPolicySchema = z.enum(recipeShareExpiryPolicies);
export const RecipeShareStatusSchema = z.enum(recipeShareStatuses);

const RecipeShareManagementBaseSchema = RecipeShareSelectSchema.omit({
  tokenHash: true,
});

export const RecipeShareSummarySchema = RecipeShareManagementBaseSchema.extend({
  status: RecipeShareStatusSchema,
});

export const CreateRecipeShareInputSchema = z.object({
  recipeId: z.uuid(),
  expiresIn: RecipeShareExpiryPolicySchema.default("forever"),
});

export const ListRecipeSharesInputSchema = z.object({
  recipeId: z.uuid(),
});

export const GetRecipeShareInputSchema = z.object({
  id: z.uuid(),
});

export const UpdateRecipeShareInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  expiresIn: RecipeShareExpiryPolicySchema,
});

export const RevokeRecipeShareInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
});

export const DeleteRecipeShareInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
});

export const ResolveSharedRecipeInputSchema = z.object({
  token: z.string().trim().min(1),
});

export const RecipeShareCreatedSchema = RecipeShareSummarySchema.extend({
  url: z.string().startsWith("/share/"),
});

export const RecipeShareMutationResultSchema = RecipeShareSummarySchema.extend({
  stale: z.boolean(),
});

export const RecipeShareDeleteResultSchema = z.object({
  success: z.literal(true),
  stale: z.boolean(),
});

export const PublicRecipeTagSchema = z.object({
  name: z.string(),
});

export const PublicRecipeAuthorSchema = z.object({
  name: z.string().nullable(),
  image: z.string().nullable(),
});

export const PublicRecipeIngredientSchema = z.object({
  ingredientName: z.string(),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  systemUsed: z.enum(measurementSystems),
  order: z.coerce.number(),
});

export const PublicRecipeImageSchema = z.object({
  image: z.string(),
  order: z.coerce.number().default(0),
});

export const PublicRecipeVideoSchema = z.object({
  video: z.string(),
  thumbnail: z.string().nullish(),
  duration: z.coerce.number().nullish(),
  order: z.coerce.number().default(0),
});

export const PublicRecipeStepSchema = z.object({
  step: z.string(),
  systemUsed: z.enum(measurementSystems),
  order: z.coerce.number(),
  images: z.array(PublicRecipeImageSchema).default([]),
});

export const PublicRecipeViewSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  url: z.string().nullable(),
  image: z.string().nullable(),
  servings: z.number().int().positive(),
  prepMinutes: z.number().int().nullable(),
  cookMinutes: z.number().int().nullable(),
  totalMinutes: z.number().int().nullable(),
  systemUsed: z.enum(measurementSystems),
  calories: z.number().int().nullable(),
  fat: z.number().nullable(),
  carbs: z.number().nullable(),
  protein: z.number().nullable(),
  categories: z.array(recipeCategorySchema).default([]),
  tags: z.array(PublicRecipeTagSchema).default([]),
  recipeIngredients: z.array(PublicRecipeIngredientSchema).default([]),
  steps: z.array(PublicRecipeStepSchema).default([]),
  author: PublicRecipeAuthorSchema.nullable(),
  images: z.array(PublicRecipeImageSchema).default([]),
  videos: z.array(PublicRecipeVideoSchema).default([]),
});
