import type { z } from "zod";

import type {
  AdminIngredientListInputSchema,
  AdminIngredientSchema,
  IngredientDetailsCreateSchema,
  IngredientDetailsUpdateSchema,
  IngredientSummarySchema,
} from "@norish/shared/contracts/zod/ingredient-pictures";

export type IngredientSummaryDto = z.output<typeof IngredientSummarySchema>;
export type AdminIngredientDto = z.output<typeof AdminIngredientSchema>;
export type AdminIngredientListInput = z.input<typeof AdminIngredientListInputSchema>;
export type IngredientDetailsCreateDto = z.input<typeof IngredientDetailsCreateSchema>;
export type IngredientDetailsUpdateDto = z.input<typeof IngredientDetailsUpdateSchema>;
