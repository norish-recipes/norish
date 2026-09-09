import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { versionColumn } from "./shared";
import { stores } from "./stores";

/**
 * A Store Product: something a Store sells, as Norish last read it. It belongs
 * to its Store, so a household shares products through the store it already
 * shares. A product with no page was typed by hand, and nothing that reads a
 * page may ever overwrite it.
 */
export const storeProducts = pgTable(
  "store_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    pageUrl: text("page_url"),
    /** The Shelf Price: what one pack costs, in the shop's own currency. */
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    /** The shop's own words for the pack: "150 gram", "1,5 l", "per stuk". */
    size: text("size"),
    /**
     * The Pack Size: what one Shelf Price buys, as a quantity and a unit of
     * the unit table, read out of the size words or set by hand. By weight
     * means sold loose — the price is for `packQuantity` of `packUnit`, and
     * any amount of it is bought. A hand-set one is flagged and no reading
     * replaces it.
     */
    packQuantity: numeric("pack_quantity", { precision: 12, scale: 3 }),
    packUnit: text("pack_unit"),
    packByWeight: boolean("pack_by_weight").notNull().default(false),
    packByHand: boolean("pack_by_hand").notNull().default(false),
    /**
     * A Sale: the regular price the shop presents beside its Shelf Price,
     * and the shop's own words for the deal. Words may stand without a
     * regular price — a deal the shop keeps as a label over its regular
     * price, shown and never priced. A hand-typed product is never on Sale.
     */
    regularPrice: numeric("regular_price", { precision: 12, scale: 2 }),
    dealWords: text("deal_words"),
    pricedAt: timestamp("priced_at", { withTimezone: true }).notNull().defaultNow(),
    isManual: boolean("is_manual").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_store_products_store_id").on(t.storeId),
    // Postgres counts NULLs as distinct, so the many by-hand products of one
    // store never collide while the same shop page is never two products.
    unique("uq_store_products_store_page").on(t.storeId, t.pageUrl),
  ]
);

/**
 * A Product Link: what a Store has learned a grocery name means. Keyed by name
 * rather than by Grocery on purpose, so it outlives the list line that
 * prompted it. A row with no product and a `triedAt` **is** a Miss: it holds
 * when the name was last tried and carries no reason. A row with no product
 * and no `triedAt` is a Pending Link: the Store has been asked and has not
 * answered yet, which is a fact about the Store and so is kept here rather
 * than on the screen that asked.
 */
export const storeProductLinks = pgTable(
  "store_product_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    normalizedName: text("normalized_name").notNull(),
    storeProductId: uuid("store_product_id").references(() => storeProducts.id, {
      onDelete: "set null",
    }),
    /** When the shop last answered for this name; null while it is still being asked. */
    triedAt: timestamp("tried_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_store_product_links_store_id").on(t.storeId),
    index("idx_store_product_links_product_id").on(t.storeProductId),
    unique("uq_store_product_links_store_name").on(t.storeId, t.normalizedName),
  ]
);
