import type { z } from "zod";

import type { IngredientSelectBaseSchema } from "@norish/shared/contracts/zod/ingredient";

export type IngredientDto = z.output<typeof IngredientSelectBaseSchema>;
