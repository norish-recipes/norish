import type { z } from "zod";

import type {
  EquipmentListItemSchema,
  EquipmentSpellingSchema,
  PublicRecipeEquipmentSchema,
  RecipeEquipmentInputSchema,
  RecipeEquipmentWithIdSchema,
} from "../zod/equipment";

export type EquipmentSpellingDto = z.output<typeof EquipmentSpellingSchema>;
export type EquipmentListItemDto = z.output<typeof EquipmentListItemSchema>;
export type RecipeEquipmentInputDto = z.input<typeof RecipeEquipmentInputSchema>;
export type RecipeEquipmentDto = z.output<typeof RecipeEquipmentWithIdSchema>;
export type PublicRecipeEquipmentDto = z.output<typeof PublicRecipeEquipmentSchema>;
