import type { z } from "zod";

import type {
  PackSizeSchema,
  StoreProductChoiceSchema,
  StoreProductLinkSelectSchema,
  StoreProductManualCreateSchema,
  StoreProductManualUpdateSchema,
  StoreProductReadingSchema,
  StoreProductSelectSchema,
} from "@norish/shared/contracts/zod";

export type StoreProductDto = z.output<typeof StoreProductSelectSchema>;
export type PackSizeDto = z.output<typeof PackSizeSchema>;
export type StoreProductLinkDto = z.output<typeof StoreProductLinkSelectSchema>;
export type StoreProductReadingInput = z.output<typeof StoreProductReadingSchema>;
export type StoreProductManualCreateInput = z.output<typeof StoreProductManualCreateSchema>;
export type StoreProductManualUpdateInput = z.output<typeof StoreProductManualUpdateSchema>;
export type StoreProductChoiceInput = z.output<typeof StoreProductChoiceSchema>;
export type StoreProductChoice = StoreProductChoiceInput["choice"];

/**
 * What a Store knows about one grocery name: its Product Link, and the product
 * it resolves to. No product and a `triedAt` is a Miss; no product and no
 * `triedAt` is a Pending Link, still being asked.
 */
export interface ResolvedProductLink {
  storeId: string;
  normalizedName: string;
  triedAt: Date | null;
  product: StoreProductDto | null;
}
