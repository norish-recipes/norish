import { createSelectSchema } from "drizzle-zod";
import z from "zod";

import { stores, ingredientStorePreferences } from "@/server/db/schema";

// Store color options (HeroUI semantic colors + extras)
export const StoreColorSchema = z.enum([
  "primary",
  "secondary",
  "success",
  "warning",
  "danger",
  "slate",
  "sky",
  "violet",
]);

export type StoreColor = z.infer<typeof StoreColorSchema>;

// Store select schema
export const StoreSelectBaseSchema = createSelectSchema(stores).omit({
  createdAt: true,
  updatedAt: true,
});

// Store insert schema (without userId - added server-side)
export const StoreInsertBaseSchema = z.object({
  userId: z.string(),
  name: z.string().min(1, "Store name is required").max(100),
  color: StoreColorSchema.default("primary"),
  icon: z.string().default("ShoppingBagIcon"),
  sortOrder: z.number().int().default(0),
});

// Store create schema (tRPC input - no userId)
export const StoreCreateSchema = z.object({
  name: z.string().min(1, "Store name is required").max(100),
  color: StoreColorSchema.default("primary"),
  icon: z.string().default("ShoppingBagIcon"),
});

// Store update schema
export const StoreUpdateBaseSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100).optional(),
  color: StoreColorSchema.optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

// Store update input schema (tRPC)
export const StoreUpdateInputSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100).optional(),
  color: StoreColorSchema.optional(),
  icon: z.string().optional(),
});

// Store delete schema with option to delete groceries
export const StoreDeleteSchema = z.object({
  storeId: z.uuid(),
  deleteGroceries: z.boolean().default(false),
});

// Store reorder schema
export const StoreReorderSchema = z.object({
  storeIds: z.array(z.uuid()),
});

// Ingredient store preference schemas
export const IngredientStorePreferenceSelectSchema = createSelectSchema(
  ingredientStorePreferences
).omit({
  createdAt: true,
  updatedAt: true,
});

export const IngredientStorePreferenceInsertSchema = z.object({
  userId: z.string(),
  normalizedName: z.string(),
  storeId: z.uuid(),
});

export const IngredientStorePreferenceUpsertSchema = z.object({
  normalizedName: z.string(),
  storeId: z.uuid(),
});
