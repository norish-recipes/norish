import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import z from "zod";

import { recipeIngredients } from "@/server/db/schema";

export const RecipeIngredientsSelectBaseSchema = createSelectSchema(recipeIngredients);
export const RecipeIngredientsInsertBaseSchema = createInsertSchema(recipeIngredients)
  .omit({
    id: true,
    updatedAt: true,
    createdAt: true,
  })
  .extend({
    amount: z.number().nullable(),
    order: z.coerce.number(),
  });

export const RecipeIngredientsUpdateBaseSchema = createUpdateSchema(recipeIngredients);

export const RecipeIngredientsWithIdSchema = RecipeIngredientsSelectBaseSchema.omit({
  updatedAt: true,
  createdAt: true,
  recipeId: true,
}).extend({
  ingredientName: z.string(),
  ingredientId: z.string().nullable(),
  amount: z.number().nullable(),
  order: z.coerce.number(),
});

export const RecipeIngredientSelectWithNameSchema = RecipeIngredientsSelectBaseSchema.extend({
  amount: z.coerce.number().nullable(),
  ingredientName: z.string(),
  order: z.coerce.number(),
}).omit({ recipeId: true });

export const RecipeIngredientInputBaseSchema = RecipeIngredientsInsertBaseSchema.partial({
  ingredientId: true,
  recipeId: true,
  systemUsed: true,
}).extend({
  amount: z.coerce.number().nullable(),
  ingredientName: z.string().trim().min(1).optional(),
  ingredientId: z.string().nullable(),
  order: z.coerce.number(),
});

export const RecipeIngredientInputSchema = RecipeIngredientInputBaseSchema.refine(
  (val) => Boolean(val.ingredientId || val.ingredientName),
  {
    message: "ingredientId or ingredientName is required",
    path: ["ingredientId"],
  }
);
