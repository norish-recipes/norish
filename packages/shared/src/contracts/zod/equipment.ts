import { z } from "zod";

export const EQUIPMENT_CATALOGUE_REFUSALS = [
  "forbidden",
  "not-found",
  "name-taken",
  "spelling-taken",
  "last-alias",
  "alias-in-use",
  "ingredient-in-use",
  "same-ingredient",
  "cycle",
  "empty",
] as const;

export type EquipmentCatalogueRefusal = (typeof EQUIPMENT_CATALOGUE_REFUSALS)[number];

export function isEquipmentCatalogueRefusal(value: unknown): value is EquipmentCatalogueRefusal {
  return (EQUIPMENT_CATALOGUE_REFUSALS as readonly unknown[]).includes(value);
}

export const EquipmentSpellingSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  seeded: z.boolean().default(false),
  canRemove: z.boolean(),
  inUse: z.boolean().default(false),
});

export const EquipmentListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  icon: z.string().nullable(),
  ownIcon: z.boolean(),
  canEdit: z.boolean(),
  aliases: z.array(EquipmentSpellingSchema),
});

export const RecipeEquipmentInputSchema = z.object({
  id: z.uuid().optional(),
  version: z.number().int().positive().optional(),
  name: z.string().trim().min(1),
  order: z.coerce.number().default(0),
});

export const RecipeEquipmentWithIdSchema = z.object({
  id: z.uuid(),
  equipmentId: z.string().nullable(),
  name: z.string(),
  order: z.coerce.number().default(0),
  version: z.number().int().positive(),
});

export const PublicRecipeEquipmentSchema = z.object({
  name: z.string(),
  order: z.coerce.number().default(0),
  icon: z.string().nullable().default(null),
});
