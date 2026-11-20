import { z } from "zod";

import { clientMintedId } from "@norish/shared/contracts/zod";

export const slotSchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);
export const itemTypeSchema = z.enum(["recipe", "note"]);

export const listItemsInput = z.object({
  startISO: z.string(),
  endISO: z.string(),
});

// Explicit boundary types keep the emitted declarations portable: inferring
// them would name the injected `@norish/shared/node_modules/zod` copy (TS2742).
export type CreateItemInput = {
  id?: string;
  date: string;
  slot: z.infer<typeof slotSchema>;
  itemType: z.infer<typeof itemTypeSchema>;
  recipeId?: string;
  title?: string;
};

export const createItemInput: z.ZodType<CreateItemInput, CreateItemInput> = z
  .object({
    id: clientMintedId,
    date: z.string(),
    slot: slotSchema,
    itemType: itemTypeSchema,
    recipeId: z.uuid().optional(),
    title: z.string().optional(),
  })
  .refine((data) => data.itemType !== "recipe" || data.recipeId, {
    message: "recipeId is required for recipe items",
  })
  .refine((data) => data.itemType !== "note" || data.title, {
    message: "title is required for note items",
  });

/** `include=notes` also lists the notes planned in the range, not only recipes. */
export const listPlannedRecipesInput = z.object({
  include: z.enum(["notes"]).optional(),
});

const MAX_RANGE_DAYS = 366;
const dayKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((v) => {
    const date = new Date(`${v}T00:00:00Z`);

    return !isNaN(date.getTime()) && date.toISOString().startsWith(v);
  }, "Not a real date");

export const listPlannedRecipesRangeInput = z
  .object({ start: dayKey, end: dayKey, include: z.enum(["notes"]).optional() })
  .refine((v) => v.end >= v.start, { message: "end must not be before start" })
  .refine((v) => (Date.parse(v.end) - Date.parse(v.start)) / 86_400_000 < MAX_RANGE_DAYS, {
    message: `The range may span at most ${MAX_RANGE_DAYS} days`,
  });

export const plannedRecipeListItemSchema = z.object({
  id: z.uuid(),
  date: z.string(),
  slot: slotSchema,
  sortOrder: z.number().int(),
  itemType: itemTypeSchema,
  recipeId: z.uuid().nullable(),
  title: z.string().nullable(),
  version: z.number().int(),
  recipeName: z.string().nullable(),
  recipeImage: z.string().nullable(),
  servings: z.number().nullable(),
  calories: z.number().nullable(),
});

export type CreatePlannedRecipeInput = {
  id?: string;
  date: string;
  slot: z.infer<typeof slotSchema>;
  recipeId?: string;
  title?: string;
};

export const createPlannedRecipeInputSchema: z.ZodType<
  CreatePlannedRecipeInput,
  CreatePlannedRecipeInput
> = z
  .object({
    id: clientMintedId,
    date: z.string(),
    slot: slotSchema,
    recipeId: z.uuid().optional(),
    title: z.string().trim().min(1).optional(),
  })
  .refine((v) => (v.recipeId === undefined) !== (v.title === undefined), {
    message: "Provide exactly one of recipeId or title",
  });

export const plannedRecipeMutationOutputSchema = z.object({
  id: z.uuid(),
});

export const deletePlannedRecipeOutputSchema = z.object({
  success: z.boolean(),
  stale: z.boolean(),
});

export type PlannedRecipeListItem = z.infer<typeof plannedRecipeListItemSchema>;
