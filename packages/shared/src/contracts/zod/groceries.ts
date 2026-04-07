import { createSelectSchema } from "drizzle-zod";
import z from "zod";

import { groceries } from "@norish/db/schema";

export const GrocerySelectBaseSchema = createSelectSchema(groceries)
  .omit({
    userId: true,
    recurringGroceryId: true,
    storeId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    amount: z.coerce.number().nullable(),
    recipeIngredientId: z.string().uuid().nullable(),
    recurringGroceryId: z.string().uuid().nullable(),
    storeId: z.string().uuid().nullable(),
    sortOrder: z.number().int(),
  });

// Insert schema with explicit fields to avoid drizzle-zod type inference issues
export const GroceryInsertBaseSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  unit: z.string().nullable(),
  amount: z.coerce.number().nullable(),
  isDone: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  recipeIngredientId: z.uuid().nullable(),
  recurringGroceryId: z.uuid().nullable(),
  storeId: z.uuid().nullable().optional(),
});

// Base update schema with explicit field definitions
export const GroceryUpdateBaseSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive().optional(),
  name: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  amount: z.coerce.number().nullable().optional(),
  isDone: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  userId: z.string().optional(),
  recipeIngredientId: z.string().uuid().nullable().optional(),
  recurringGroceryId: z.string().uuid().nullable().optional(),
  storeId: z.string().uuid().nullable().optional(),
});

const GroceryVersionInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
});

const GroceryStoreReorderInputSchema = GroceryVersionInputSchema.extend({
  sortOrder: z.number().int().min(0),
  storeId: z.uuid().nullable().optional(),
});

// Create schema without userId (added server-side)
export const GroceryCreateSchema = z.object({
  name: z.string().nullable(),
  unit: z.string().nullable(),
  amount: z.coerce.number().nullable(),
  isDone: z.boolean().default(false),
  recipeIngredientId: z.uuid().nullable().optional(),
  recurringGroceryId: z.uuid().nullable().optional(),
  storeId: z.uuid().nullable().optional(),
});

// tRPC input schemas
export const GroceryUpdateInputSchema = z.object({
  groceryId: z.string(),
  raw: z.string(),
  version: z.number().int().positive(),
});

export const GroceryToggleSchema = z.object({
  groceries: z.array(GroceryVersionInputSchema),
  isDone: z.boolean(),
});

export const GroceryDeleteSchema = z.object({
  groceries: z.array(GroceryVersionInputSchema),
});

export const AssignGroceryToStoreInputSchema = z.object({
  groceryId: z.uuid(),
  version: z.number().int().positive(),
  storeId: z.uuid().nullable(),
  savePreference: z.boolean().default(true),
});

export const ReorderGroceriesInStoreInputSchema = z.object({
  updates: z.array(GroceryStoreReorderInputSchema),
  savePreference: z.boolean().default(true),
});

export const MarkAllDoneGroceriesInputSchema = z.object({
  storeId: z.uuid().nullable(),
  groceries: z.array(GroceryVersionInputSchema),
});

export const DeleteDoneGroceriesInputSchema = z.object({
  storeId: z.uuid().nullable(),
  groceries: z.array(GroceryVersionInputSchema),
});
