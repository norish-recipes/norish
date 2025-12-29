import type { z } from "zod";
import type {
  StoreSelectBaseSchema,
  StoreInsertBaseSchema,
  StoreUpdateBaseSchema,
  StoreCreateSchema,
  StoreUpdateInputSchema,
  StoreDeleteSchema,
  StoreReorderSchema,
  IngredientStorePreferenceSelectSchema,
  IngredientStorePreferenceUpsertSchema,
  StoreColorSchema,
} from "@/server/db/zodSchemas";

export type StoreDto = z.output<typeof StoreSelectBaseSchema>;
export type StoreInsertDto = z.input<typeof StoreInsertBaseSchema>;
export type StoreUpdateDto = z.input<typeof StoreUpdateBaseSchema>;
export type StoreCreateDto = z.input<typeof StoreCreateSchema>;
export type StoreUpdateInput = z.infer<typeof StoreUpdateInputSchema>;
export type StoreDeleteInput = z.infer<typeof StoreDeleteSchema>;
export type StoreReorderInput = z.infer<typeof StoreReorderSchema>;
export type StoreColor = z.infer<typeof StoreColorSchema>;

export type IngredientStorePreferenceDto = z.output<typeof IngredientStorePreferenceSelectSchema>;
export type IngredientStorePreferenceUpsertInput = z.infer<typeof IngredientStorePreferenceUpsertSchema>;
