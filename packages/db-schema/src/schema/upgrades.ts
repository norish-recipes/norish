import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import type { ProductSuggestion } from "./store-products";

/** A parked link's row as migration 0075 found it, in the columns of that day. */
export interface ParkedLinkRow {
  normalized_name: string;
  store_id: string;
  user_id?: string;
  aisle_id?: string;
  store_product_id?: string | null;
  tried_at?: string | null;
  suggestion?: ProductSuggestion | null;
  created_at: string;
  updated_at: string;
}

/**
 * A Product Link, Aisle Link or store preference from before 0.25, keyed by its folded name only:
 * migration 0075 parks the row as it stood, for the boot upgrade (startup/upgrades) to key by food.
 */
export const parkedNameKeyedLinks = pgTable("parked_name_keyed_links", {
  id: uuid("id").primaryKey(),
  kind: text("kind").$type<"aisle" | "product" | "preference">().notNull(),
  link: jsonb("link").$type<ParkedLinkRow>().notNull(),
});
