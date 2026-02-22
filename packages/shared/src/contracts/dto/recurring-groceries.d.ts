import type { z } from "zod";
import type {
  RecurringGrocerySelectBaseSchema,
  RecurringGroceryInsertBaseSchema,
  RecurringGroceryUpdateBaseSchema,
  RecurringGroceryCreateSchema,
} from "@norish/shared/contracts/zod";

export type RecurringGroceryDto = z.output<typeof RecurringGrocerySelectBaseSchema>;
export type RecurringGroceryInsertDto = z.input<typeof RecurringGroceryInsertBaseSchema>;
export type RecurringGroceryUpdateDto = z.input<typeof RecurringGroceryUpdateBaseSchema>;
export type RecurringGroceryCreateDto = z.input<typeof RecurringGroceryCreateSchema>;
