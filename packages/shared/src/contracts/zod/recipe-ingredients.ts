import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import z from "zod";

import { recipeIngredients } from "@norish/db-schema/schema";

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

// A line's as-written text travels as `ingredientName`, and its alias stays on
// the server: clients read and write the text.
export const RecipeIngredientsWithIdSchema = RecipeIngredientsSelectBaseSchema.omit({
  updatedAt: true,
  createdAt: true,
  recipeId: true,
  name: true,
  ingredientAliasId: true,
}).extend({
  ingredientName: z.string(),
  ingredientId: z.string().nullable(),
  amount: z.number().nullable(),
  order: z.coerce.number(),
});

export const RecipeIngredientSelectWithNameSchema = RecipeIngredientsSelectBaseSchema.extend({
  ingredientId: z.string().nullable(),
  amount: z.coerce.number().nullable(),
  ingredientName: z.string(),
  order: z.coerce.number(),
}).omit({ recipeId: true });

export const RecipeIngredientInputBaseSchema = RecipeIngredientsInsertBaseSchema.omit({
  name: true,
  ingredientAliasId: true,
})
  .partial({
    recipeId: true,
    systemUsed: true,
  })
  .extend({
    id: z.uuid().optional(),
    version: z.number().int().positive().optional(),
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
