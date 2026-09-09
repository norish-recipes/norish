import { createSelectSchema } from "drizzle-zod";
import z from "zod";

import { storeProductLinks, storeProducts } from "@norish/db-schema/schema";

import { httpUrlSchema } from "../../lib/schema";
import { UNIT_IDS } from "../../lib/units";
import { clientMintedId } from "./common";

/** A Pack Size as it travels: a quantity, a unit of the unit table, and whether it is sold loose. */
export const PackSizeSchema = z.object({
  quantity: z.number().positive().max(1_000_000),
  unit: z.enum(UNIT_IDS),
  byWeight: z.boolean(),
});

export const StoreProductSelectSchema = createSelectSchema(storeProducts)
  .omit({ createdAt: true, updatedAt: true })
  .extend({
    price: z.coerce.number(),
    pageUrl: z.string().nullable(),
    size: z.string().nullable(),
    packQuantity: z.coerce.number().nullable(),
    packUnit: z.string().nullable(),
    regularPrice: z.coerce.number().nullable(),
    dealWords: z.string().nullable(),
  });

/** The Sale a shop presents: the regular price beside its price, and its own words for the deal. */
const SaleFields = {
  regularPrice: z.number().nonnegative().nullish(),
  dealWords: z.string().max(120).nullish(),
};

export const StoreProductLinkSelectSchema = createSelectSchema(storeProductLinks).omit({
  createdAt: true,
  updatedAt: true,
});

/** A currency as a page or a person states it: three letters, upper case. */
export const CurrencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase());

/** A product read from a shop page: the page is what makes it the same product. */
export const StoreProductReadingSchema = z.object({
  storeId: z.uuid(),
  name: z.string().min(1).max(300),
  pageUrl: httpUrlSchema,
  price: z.number().nonnegative(),
  currency: CurrencyCodeSchema,
  size: z.string().max(80).nullish(),
  pack: PackSizeSchema.nullish(),
  ...SaleFields,
});

/**
 * A Store Product someone typed: for a shop Norish cannot read, or a shop's
 * own product corrected by hand, which keeps the Sale and the pack of the
 * product it corrects.
 */
export const StoreProductManualCreateSchema = z.object({
  id: clientMintedId,
  storeId: z.uuid(),
  name: z.string().min(1).max(300),
  price: z.number().nonnegative(),
  currency: CurrencyCodeSchema,
  size: z.string().max(80).nullish(),
  pack: PackSizeSchema.nullish(),
  ...SaleFields,
});

export const StoreProductManualUpdateSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(300).optional(),
  price: z.number().nonnegative().optional(),
  currency: CurrencyCodeSchema.optional(),
  size: z.string().max(80).nullish(),
  pack: PackSizeSchema.nullish(),
  ...SaleFields,
});

/** One priced result of a shop's own search, as the reader read it. */
export const StoreCandidateSchema = z.object({
  name: z.string().min(1).max(300),
  url: httpUrlSchema,
  price: z.number().nonnegative(),
  currency: CurrencyCodeSchema,
  size: z.string().max(80).nullish(),
  pack: PackSizeSchema.nullish(),
  ...SaleFields,
});

/**
 * What the picker decided a grocery name means: a product this Store already
 * knows, a result of a search just run, a price typed by hand, or nothing at
 * all — which is a Miss the user chose. `pack` beside it is a Pack Size the
 * shopper set by hand for whichever product the choice resolves to: absent
 * where the field was left alone, null where it was cleared, so the reading
 * is the pack again.
 */
export const StoreProductChoiceSchema = z.object({
  storeId: z.uuid(),
  name: z.string().min(1).max(300),
  choice: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("product"), storeProductId: z.uuid() }),
    z.object({ kind: z.literal("candidate"), candidate: StoreCandidateSchema }),
    z.object({
      kind: z.literal("manual"),
      id: clientMintedId,
      name: z.string().min(1).max(300),
      price: z.number().nonnegative(),
      currency: CurrencyCodeSchema,
      size: z.string().max(80).nullish(),
      // What a correction inherits from the product it corrects.
      pack: PackSizeSchema.nullish(),
      ...SaleFields,
    }),
  ]),
  pack: PackSizeSchema.nullable().optional(),
});

/** Searching a Store's own shop for a term the user chose. */
export const StoreShopSearchSchema = z.object({
  storeId: z.uuid(),
  term: z.string().min(1).max(200),
});

export const StoreProductsListInputSchema = z.object({ storeId: z.uuid() });

/** What one Store has learned one grocery name means, if anything. */
export const StoreProductLinkLookupSchema = z.object({
  storeId: z.uuid(),
  name: z.string().min(1).max(300),
});
