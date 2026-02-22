import type { IngredientSelectBaseSchema } from "@norish/shared/contracts/zod/ingredient";
import type { z } from "zod";

export type IngredientDto = z.output<typeof IngredientSelectBaseSchema>;
