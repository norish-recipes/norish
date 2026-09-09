import { createSelectSchema } from "drizzle-zod";
import z from "zod";

import { aisleLinks, aisles, ingredientStorePreferences, stores } from "@norish/db-schema/schema";

import { httpUrlSchema } from "../../lib/schema";
import { isSearchAddress, SEARCH_ADDRESS_PLACEHOLDER } from "../../lib/search-address";
import { clientMintedId } from "./common";

/** The shop's website: an http(s) address and nothing else. */
export const StoreWebsiteSchema = httpUrlSchema;

/** The shop's search page, carrying the `{query}` slot exactly once. */
export const StoreSearchAddressSchema = z
  .string()
  .refine(
    isSearchAddress,
    `A Search Address is an http address carrying ${SEARCH_ADDRESS_PLACEHOLDER} once`
  );

// Store color options (HeroUI semantic colors + extras)
export const StoreColorSchema = z.enum([
  "primary",
  "secondary",
  "success",
  "warning",
  "danger",
  "slate",
  "sky",
  "violet",
]);

export type StoreColor = z.infer<typeof StoreColorSchema>;

/** An aisle's name: one to a hundred characters, with the whitespace around it gone. */
export const AisleNameSchema = z.string().trim().min(1, "Aisle name is required").max(100);

// An Aisle as the Store carries it: ordered by `sortOrder`, one list per Store.
export const AisleSelectSchema = createSelectSchema(aisles).omit({
  createdAt: true,
  updatedAt: true,
});

/**
 * An aisle as the Store editor sends it: a client-minted id (ADR-0003), a
 * name, and for a known aisle the version the editor saw. Its position in the
 * list is its order. A known id is renamed and repositioned where its version
 * still holds (ADR-0004: the first writer wins, a later one is dropped), a new
 * id is created, and an aisle absent from the list is deleted with its Aisle
 * Links.
 */
export const AisleInputSchema = z.object({
  id: z.uuid(),
  name: AisleNameSchema,
  version: z.number().int().positive().optional(),
});

export const StoreAislesInputSchema = z.array(AisleInputSchema);

// Store select schema: a Store travels with its Aisles, in order (ADR-0031).
export const StoreSelectBaseSchema = createSelectSchema(stores)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .extend({ aisles: z.array(AisleSelectSchema) });

// Store insert schema (without userId - added server-side)
export const StoreInsertBaseSchema = z.object({
  userId: z.string(),
  name: z.string().min(1, "Store name is required").max(100),
  color: StoreColorSchema.default("primary"),
  icon: z.string().default("ShoppingBagIcon"),
  sortOrder: z.number().int().default(0),
  website: StoreWebsiteSchema.nullish(),
  searchAddress: StoreSearchAddressSchema.nullish(),
  aisles: StoreAislesInputSchema.optional(),
});

// Store create schema: the public REST create, which makes a Store with no aisles
export const StoreCreateSchema = z.object({
  id: clientMintedId,
  name: z.string().min(1, "Store name is required").max(100),
  color: StoreColorSchema.default("primary"),
  icon: z.string().default("ShoppingBagIcon"),
  website: StoreWebsiteSchema.nullish(),
  searchAddress: StoreSearchAddressSchema.nullish(),
});

// Store create input (tRPC): the same Store, with its aisles in one go
export const StoreCreateInputSchema = StoreCreateSchema.extend({
  aisles: StoreAislesInputSchema.optional(),
});

// Store update schema. `aisles` absent leaves the Store's aisles as they are;
// present, it is the whole ordered list and is reconciled against what is stored.
export const StoreUpdateBaseSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive().optional(),
  name: z.string().min(1).max(100).optional(),
  color: StoreColorSchema.optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
  website: StoreWebsiteSchema.nullish(),
  searchAddress: StoreSearchAddressSchema.nullish(),
  aisles: StoreAislesInputSchema.optional(),
});

// Store update input schema (tRPC)
export const StoreUpdateInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  name: z.string().min(1).max(100).optional(),
  color: StoreColorSchema.optional(),
  icon: z.string().optional(),
  website: StoreWebsiteSchema.nullish(),
  searchAddress: StoreSearchAddressSchema.nullish(),
  aisles: StoreAislesInputSchema.optional(),
});

// An Aisle Link: where a Store files one normalized grocery name (ADR-0031).
export const AisleLinkSelectSchema = createSelectSchema(aisleLinks).pick({
  storeId: true,
  normalizedName: true,
  aisleId: true,
});

/**
 * Filing a name: a Store, the name as typed, and one of the Store's aisles —
 * or null, which forgets the name. The server folds the name.
 */
export const AisleFilingSchema = z.object({
  storeId: z.uuid(),
  name: z.string().min(1).max(300),
  aisleId: z.uuid().nullable(),
});

// Asking a Store's shop whether its Search Address works, with the user's own term
export const StoreSearchAddressCheckSchema = z.object({
  storeId: z.uuid(),
  term: z.string().max(200).nullish(),
  /**
   * The address and website the client just saved. A store update is
   * optimistic and may still be in flight, so without these the check can
   * probe the address the user has just replaced — or, for a homepage pasted
   * into an existing Store, read no website at all and never go looking for
   * its search page.
   */
  searchAddress: StoreSearchAddressSchema.nullish(),
  website: StoreWebsiteSchema.nullish(),
});

// Store delete schema with snapshot-based grocery handling
export const StoreDeleteSchema = z.object({
  storeId: z.uuid(),
  version: z.number().int().positive(),
  deleteGroceries: z.boolean().default(false),
  grocerySnapshot: z.array(z.object({ id: z.uuid(), version: z.number().int().positive() })),
});

// Store reorder schema
export const StoreReorderSchema = z.object({
  stores: z.array(
    z.object({
      id: z.uuid(),
      version: z.number().int().positive(),
    })
  ),
});

// Ingredient store preference schemas
export const IngredientStorePreferenceSelectSchema = createSelectSchema(
  ingredientStorePreferences
).omit({
  createdAt: true,
  updatedAt: true,
});

export const IngredientStorePreferenceInsertSchema = z.object({
  userId: z.string(),
  normalizedName: z.string(),
  storeId: z.uuid(),
});

export const IngredientStorePreferenceUpsertSchema = z.object({
  normalizedName: z.string(),
  storeId: z.uuid(),
});
