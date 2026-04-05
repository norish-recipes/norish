import { z } from "zod";

import { measurementSystems, recipeCategorySchema } from "./recipe";

export const recipeShareExpiryPolicies = ["1day", "1week", "1month", "1year", "forever"] as const;
export const recipeShareStatuses = ["active", "expired", "revoked"] as const;
export const recipeShareLifecycleEventTypes = [
  "created",
  "updated",
  "revoked",
  "reactivated",
  "deleted",
] as const;

export const RecipeShareSelectSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  recipeId: z.uuid(),
  tokenHash: z.string(),
  expiresAt: z.date().nullable(),
  revokedAt: z.date().nullable(),
  lastAccessedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});
export const RecipeShareExpiryPolicySchema = z.enum(recipeShareExpiryPolicies);
export const RecipeShareStatusSchema = z.enum(recipeShareStatuses);
export const RecipeShareLifecycleEventTypeSchema = z.enum(recipeShareLifecycleEventTypes);

const RecipeShareManagementBaseSchema = RecipeShareSelectSchema.omit({
  tokenHash: true,
});

// Backward-compatible alias for older linked workspace copies.
export const RecipeShareManagementSummarySchema = RecipeShareManagementBaseSchema.extend({
  status: RecipeShareStatusSchema,
});

export const RecipeShareSummarySchema = RecipeShareManagementSummarySchema;

export const RecipeShareInventorySchema = RecipeShareSummarySchema.extend({
  recipeName: z.string(),
});

export const AdminRecipeShareInventorySchema = RecipeShareInventorySchema.extend({
  ownerId: z.string(),
  ownerName: z.string().nullable(),
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

export const ReactivateRecipeShareInputSchema = z.object({
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

export const RecipeShareLifecycleEventSchema = z.object({
  type: RecipeShareLifecycleEventTypeSchema,
  recipeId: z.uuid(),
  shareId: z.uuid(),
  version: z.number().int().positive(),
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
  fat: z.string().nullable(),
  carbs: z.string().nullable(),
  protein: z.string().nullable(),
  categories: z.array(recipeCategorySchema).default([]),
  tags: z.array(PublicRecipeTagSchema).default([]),
  recipeIngredients: z.array(PublicRecipeIngredientSchema).default([]),
  steps: z.array(PublicRecipeStepSchema).default([]),
  author: PublicRecipeAuthorSchema.nullable(),
  images: z.array(PublicRecipeImageSchema).default([]),
  videos: z.array(PublicRecipeVideoSchema).default([]),
});
