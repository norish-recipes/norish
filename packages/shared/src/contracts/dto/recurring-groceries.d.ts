import type { z } from "zod";

import type {
  RecurringGroceryCreateSchema,
  RecurringGroceryInsertBaseSchema,
  RecurringGrocerySelectBaseSchema,
  RecurringGroceryUpdateBaseSchema,
} from "@norish/shared/contracts/zod";

export type RecurringGroceryDto = z.output<typeof RecurringGrocerySelectBaseSchema>;
export type RecurringGroceryInsertDto = z.input<typeof RecurringGroceryInsertBaseSchema>;
export type RecurringGroceryUpdateDto = z.input<typeof RecurringGroceryUpdateBaseSchema>;
export type RecurringGroceryCreateDto = z.input<typeof RecurringGroceryCreateSchema>;
