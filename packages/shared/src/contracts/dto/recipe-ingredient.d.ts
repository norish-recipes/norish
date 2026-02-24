import type { z } from "zod";

import type {
  RecipeIngredientInputSchema,
  RecipeIngredientsWithIdSchema,
} from "@norish/shared/contracts/zod/recipe-ingredients";

export type RecipeIngredientInsertDto = z.input<typeof RecipeIngredientInputSchema>;
export type RecipeIngredientsDto = z.output<typeof RecipeIngredientsWithIdSchema>;
