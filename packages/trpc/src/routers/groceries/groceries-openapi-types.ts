import { z } from "zod";

import type { GroceryDto } from "@norish/shared/contracts";
import { GrocerySelectBaseSchema } from "@norish/db";

export const createGroceryApiInputSchema = z.object({
  name: z.string().nullable(),
  unit: z.string().nullable(),
  amount: z.coerce.number().nullable(),
  isDone: z.boolean().default(false),
  storeId: z.string().uuid().nullable().optional(),
});

export const groceryIdVersionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
});

export const deleteGroceryOutputSchema = z.object({
  success: z.boolean(),
  stale: z.boolean(),
});

type GroceryMutationOutput = {
  grocery: GroceryDto | null;
  stale: boolean;
};

export const groceryMutationOutputSchema: z.ZodType<GroceryMutationOutput> = z.object({
  grocery: GrocerySelectBaseSchema.nullable(),
  stale: z.boolean(),
});

export const assignGroceryToStoreApiInputSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  storeId: z.string().uuid().nullable(),
  savePreference: z.boolean().default(true),
});
