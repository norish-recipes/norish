import { z } from "zod";

import type { GroceryDto, MutationAck, MutationAckWith } from "@norish/shared/contracts";
import { GrocerySelectBaseSchema } from "@norish/db";
import { mutationAckSchema } from "@norish/shared/contracts";

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

export const deleteGroceryOutputSchema: z.ZodType<MutationAck> = mutationAckSchema;

export type GroceryMutationOutput = MutationAckWith<{
  grocery: GroceryDto | null;
}>;

export const groceryMutationOutputSchema: z.ZodType<GroceryMutationOutput> =
  mutationAckSchema.extend({
    grocery: GrocerySelectBaseSchema.nullable(),
  });

export const assignGroceryToStoreApiInputSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  storeId: z.string().uuid().nullable(),
  savePreference: z.boolean().default(true),
});
