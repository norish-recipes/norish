import type { z } from "zod";

import type {
  AisleFilingSchema,
  AisleInputSchema,
  AisleLinkSelectSchema,
  AisleSelectSchema,
  IngredientStorePreferenceSelectSchema,
  IngredientStorePreferenceUpsertSchema,
  StoreColorSchema,
  StoreCreateInputSchema,
  StoreDeleteSchema,
  StoreInsertBaseSchema,
  StoreReorderSchema,
  StoreSearchAddressCheckSchema,
  StoreSelectBaseSchema,
  StoreUpdateBaseSchema,
  StoreUpdateInputSchema,
} from "@norish/shared/contracts/zod";

export type StoreDto = z.output<typeof StoreSelectBaseSchema>;
export type StoreInsertDto = z.input<typeof StoreInsertBaseSchema>;
export type StoreUpdateDto = z.input<typeof StoreUpdateBaseSchema>;
export type StoreCreateDto = z.input<typeof StoreCreateInputSchema>;
export type StoreUpdateInput = z.infer<typeof StoreUpdateInputSchema>;
export type StoreDeleteInput = z.infer<typeof StoreDeleteSchema> & {
  grocerySnapshot: Array<{ id: string; version: number }>;
};
export type StoreReorderInput = z.infer<typeof StoreReorderSchema>;
export type StoreSearchAddressCheckInput = z.infer<typeof StoreSearchAddressCheckSchema>;
export type StoreColor = z.infer<typeof StoreColorSchema>;

/** An Aisle: a heading within a Store, in the order the household walks them. */
export type AisleDto = z.output<typeof AisleSelectSchema>;
/** An aisle as the editor sends it: a client-minted id and a name; its position is its order. */
export type AisleInput = z.infer<typeof AisleInputSchema>;
/** An Aisle Link as stored: where a Store files one normalized grocery name. */
export type AisleLinkDto = z.output<typeof AisleLinkSelectSchema>;
export type AisleFilingInput = z.infer<typeof AisleFilingSchema>;
/**
 * What a Store now files a name under, as the household hears it: an aisle, or
 * null where the name has been forgotten. Merged by store and normalized name.
 */
export interface AisleFiled {
  storeId: string;
  normalizedName: string;
  aisleId: string | null;
}

export type IngredientStorePreferenceDto = z.output<typeof IngredientStorePreferenceSelectSchema>;
export type IngredientStorePreferenceUpsertInput = z.infer<
  typeof IngredientStorePreferenceUpsertSchema
>;
