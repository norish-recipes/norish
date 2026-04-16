import { z } from "zod";

export const slotSchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);
export const itemTypeSchema = z.enum(["recipe", "note"]);

export const listItemsInput = z.object({
  startISO: z.string(),
  endISO: z.string(),
});

export const createItemInput = z
  .object({
    date: z.string(),
    slot: slotSchema,
    itemType: itemTypeSchema,
    recipeId: z.string().uuid().optional(),
    title: z.string().optional(),
  })
  .refine((data) => data.itemType !== "recipe" || data.recipeId, {
    message: "recipeId is required for recipe items",
  })
  .refine((data) => data.itemType !== "note" || data.title, {
    message: "title is required for note items",
  });

export const plannedRecipeListItemSchema = z.object({
  id: z.uuid(),
  date: z.string(),
  slot: slotSchema,
  sortOrder: z.number().int(),
  recipeId: z.uuid(),
  version: z.number().int(),
  recipeName: z.string().nullable(),
  recipeImage: z.string().nullable(),
  servings: z.number().nullable(),
  calories: z.number().nullable(),
});

export const createPlannedRecipeInputSchema = z.object({
  date: z.string(),
  slot: slotSchema,
  recipeId: z.string().uuid(),
});

export const plannedRecipeMutationOutputSchema = z.object({
  id: z.uuid(),
});

export const deletePlannedRecipeOutputSchema = z.object({
  success: z.boolean(),
  stale: z.boolean(),
});

export type CreateItemInput = z.infer<typeof createItemInput>;
export type PlannedRecipeListItem = z.infer<typeof plannedRecipeListItemSchema>;
