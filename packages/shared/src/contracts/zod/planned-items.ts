import { z } from "zod";

const slotSchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);

const plannedItemTypeSchema = z.enum(["recipe", "note"]);

export const PlannedItemEventPayloadSchema = z.object({
  id: z.string(),
  date: z.string(),
  slot: slotSchema,
  sortOrder: z.number(),
  itemType: plannedItemTypeSchema,
  recipeId: z.string().nullable(),
  title: z.string().nullable(),
  userId: z.string(),
});

export const PlannedItemWithRecipePayloadSchema = PlannedItemEventPayloadSchema.extend({
  recipeName: z.string().nullable(),
  recipeImage: z.string().nullable(),
  servings: z.number().nullable(),
  calories: z.number().nullable(),
});

export const SlotItemSortUpdateSchema = z.object({
  id: z.string(),
  sortOrder: z.number(),
});

export type PlannedItemEventPayload = z.infer<typeof PlannedItemEventPayloadSchema>;
export type PlannedItemWithRecipePayload = z.infer<typeof PlannedItemWithRecipePayloadSchema>;
export type SlotItemSortUpdate = z.infer<typeof SlotItemSortUpdateSchema>;
