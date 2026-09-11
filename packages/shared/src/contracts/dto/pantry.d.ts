import type { z } from "zod";

import type {
  PantryIngredientAddSchema,
  PantryIngredientRemoveSchema,
  PantryIngredientSelectSchema,
} from "@norish/shared/contracts/zod";

/** A Pantry Ingredient: one name the household has at home, with its folded form. */
export type PantryIngredientDto = z.output<typeof PantryIngredientSelectSchema>;
export type PantryIngredientAddInput = z.infer<typeof PantryIngredientAddSchema>;
export type PantryIngredientRemoveInput = z.infer<typeof PantryIngredientRemoveSchema>;
