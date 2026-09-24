/**
 * Store realtime catalogue. Stores belong to a household, so every event is
 * household-scoped.
 */

import { z } from "zod";

import type {
  AisleFiled,
  ResolvedProductLink,
  StoreDto,
  StoreProductDto,
} from "@norish/shared/contracts";

import { defineRealtimeCatalogue } from "./catalogue";

export const storesRealtime = defineRealtimeCatalogue("store", {
  // z.custom: StoreDto has no standalone zod schema yet.
  created: { scope: "household", payload: z.custom<{ store: StoreDto }>() },
  // z.custom: StoreDto has no standalone zod schema yet.
  updated: { scope: "household", payload: z.custom<{ store: StoreDto }>() },
  deleted: {
    scope: "household",
    payload: z.object({ storeId: z.string(), deletedGroceryIds: z.array(z.string()) }),
  },
  // z.custom: StoreDto has no standalone zod schema yet.
  reordered: { scope: "household", payload: z.custom<{ stores: StoreDto[] }>() },
  /** A Store Product read, typed or refreshed; merged by product id. */
  // z.custom: StoreProductDto has no standalone zod schema yet.
  productUpdated: { scope: "household", payload: z.custom<{ product: StoreProductDto }>() },
  /** What a Store now knows a name means; merged by store and normalized name. */
  // z.custom: ResolvedProductLink is an interface without a zod schema.
  linkUpdated: { scope: "household", payload: z.custom<{ link: ResolvedProductLink }>() },
  /**
   * Where a Store now files a name, or null where it has forgotten it; merged
   * by store and normalized name, a null removing the entry (ADR-0031).
   */
  // z.custom: AisleFiled is an interface without a zod schema.
  aisleFiled: { scope: "household", payload: z.custom<{ filing: AisleFiled }>() },
});

export type StoresRealtime = typeof storesRealtime;
