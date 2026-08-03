import type { z } from "zod";

import type {
  StepIngredientOutputSchema,
  StepIngredientSchema,
} from "@norish/shared/contracts/zod/step-ingredients";

export type StepIngredientInputDto = z.input<typeof StepIngredientSchema>;
export type StepIngredientDto = z.output<typeof StepIngredientOutputSchema>;
