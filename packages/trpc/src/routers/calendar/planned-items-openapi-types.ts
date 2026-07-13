import { z } from "zod";

import type { MutationAck, MutationAckWith } from "@norish/shared/contracts";
import { mutationAckSchema } from "@norish/shared/contracts";

export const slotSchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);
export const itemTypeSchema = z.enum(["recipe", "note"]);

export const listItemsInput = z.object({
  startISO: z.string(),
  endISO: z.string(),
});

export const createItemInput = z
  .object({
    id: z.uuid().optional(),
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
  id: z.uuid().optional(),
  date: z.string(),
  slot: slotSchema,
  recipeId: z.string().uuid(),
});

export const plannedRecipeMutationOutputSchema: z.ZodType<MutationAckWith<{ id: string }>> =
  mutationAckSchema.extend({
    id: z.uuid(),
  });

export const deletePlannedRecipeOutputSchema: z.ZodType<MutationAck> = mutationAckSchema;

export type CreateItemInput = z.infer<typeof createItemInput>;
export type PlannedRecipeListItem = z.infer<typeof plannedRecipeListItemSchema>;
export type PlannedRecipeMutationOutput = MutationAckWith<{ id: string }>;
