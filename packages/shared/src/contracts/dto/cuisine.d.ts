import type { z } from "zod";

import type {
  CuisineSelectBaseSchema,
  CuisineSummarySchema,
} from "@norish/shared/contracts/zod/cuisine";

export type CuisineDto = z.output<typeof CuisineSelectBaseSchema>;
export type CuisineSummaryDto = z.output<typeof CuisineSummarySchema>;
