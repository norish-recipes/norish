import type { z } from "zod";

import type {
  IngredientStorePreferenceSelectSchema,
  IngredientStorePreferenceUpsertSchema,
  StoreColorSchema,
  StoreCreateSchema,
  StoreDeleteSchema,
  StoreInsertBaseSchema,
  StoreReorderSchema,
  StoreSelectBaseSchema,
  StoreUpdateBaseSchema,
  StoreUpdateInputSchema,
} from "@norish/shared/contracts/zod";

export type StoreDto = z.output<typeof StoreSelectBaseSchema>;
export type StoreInsertDto = z.input<typeof StoreInsertBaseSchema>;
export type StoreUpdateDto = z.input<typeof StoreUpdateBaseSchema>;
export type StoreCreateDto = z.input<typeof StoreCreateSchema>;
export type StoreUpdateInput = z.infer<typeof StoreUpdateInputSchema>;
export type StoreDeleteInput = z.infer<typeof StoreDeleteSchema> & {
  grocerySnapshot: Array<{ id: string; version: number }>;
};
export type StoreReorderInput = z.infer<typeof StoreReorderSchema>;
export type StoreColor = z.infer<typeof StoreColorSchema>;

export type IngredientStorePreferenceDto = z.output<typeof IngredientStorePreferenceSelectSchema>;
export type IngredientStorePreferenceUpsertInput = z.infer<
  typeof IngredientStorePreferenceUpsertSchema
>;
