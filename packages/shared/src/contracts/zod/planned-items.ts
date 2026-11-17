import { z } from "zod";

export const slotSchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);

const plannedItemTypeSchema = z.enum(["recipe", "note"]);

export const PlannedItemMoveInputSchema = z.object({
  itemId: z.uuid(),
  version: z.number().int().positive(),
  targetDate: z.string(),
  targetSlot: slotSchema,
  /** Omitted: last in the target slot, as the server finds it. */
  targetIndex: z.number().int().min(0).optional(),
});

export const PlannedItemDeleteInputSchema = z.object({
  itemId: z.uuid(),
  version: z.number().int().positive(),
});

/** One edit of a planned item: whichever of its text, day and slot changed, written together. */
export const PlannedItemEditInputSchema = z.object({
  itemId: z.uuid(),
  version: z.number().int().positive(),
  title: z.string().min(1).optional(),
  date: z.string().optional(),
  slot: slotSchema.optional(),
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
