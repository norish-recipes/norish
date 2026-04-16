import { z } from "zod";

const slotSchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);

const plannedItemTypeSchema = z.enum(["recipe", "note"]);

export const PlannedItemMoveInputSchema = z.object({
  itemId: z.string().uuid(),
  version: z.number().int().positive(),
  targetDate: z.string(),
  targetSlot: slotSchema,
  targetIndex: z.number().int().min(0),
});

export const PlannedItemDeleteInputSchema = z.object({
  itemId: z.string().uuid(),
  version: z.number().int().positive(),
});

export const PlannedItemUpdateInputSchema = z.object({
  itemId: z.string().uuid(),
  version: z.number().int().positive(),
  title: z.string().min(1),
});

export const PlannedItemEventPayloadSchema = z.object({
  id: z.string(),
  date: z.string(),
  slot: slotSchema,
  sortOrder: z.number(),
  itemType: plannedItemTypeSchema,
  recipeId: z.string().nullable(),
  title: z.string().nullable(),
  userId: z.string(),
  version: z.number(),
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
