import type { z } from "zod";
import type {
  GrocerySelectBaseSchema,
  GroceryInsertBaseSchema,
  GroceryUpdateBaseSchema,
  GroceryCreateSchema,
  GroceryUpdateInputSchema,
  GroceryToggleSchema,
  GroceryDeleteSchema,
} from "@norish/shared/contracts/zod";

export type GroceryDto = z.output<typeof GrocerySelectBaseSchema>;
export type GroceryInsertDto = z.input<typeof GroceryInsertBaseSchema>;
export type GroceryUpdateDto = z.input<typeof GroceryUpdateBaseSchema>;

export type GroceryCreateDto = z.input<typeof GroceryCreateSchema>;

// tRPC input types
export type GroceryUpdateInput = z.infer<typeof GroceryUpdateInputSchema>;
export type GroceryToggleInput = z.infer<typeof GroceryToggleSchema>;
export type GroceryDeleteInput = z.infer<typeof GroceryDeleteSchema>;
