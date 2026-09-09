import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import z from "zod";

import type {
  PackSizeDto,
  ResolvedProductLink,
  StoreProductDto,
  StoreProductManualCreateInput,
  StoreProductManualUpdateInput,
  StoreProductReadingInput,
} from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import { storeProductLinks, storeProducts } from "@norish/db/schema";
import {
  StoreProductLinkSelectSchema,
  StoreProductSelectSchema,
} from "@norish/shared/contracts/zod";
import { normalizeGroceryName, productLinkKey } from "@norish/shared/lib/normalized-name";
import { readPackSize } from "@norish/shared/lib/pack-size";

const ProductSchema = StoreProductSelectSchema;
const ProductsSchema = z.array(StoreProductSelectSchema);

function parseProduct(row: unknown): StoreProductDto {
  const parsed = ProductSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to parse store product");

  return parsed.data;
}

function parseProducts(rows: unknown[]): StoreProductDto[] {
  const parsed = ProductsSchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse store products");

  return parsed.data;
}

/** The price as Postgres wants it: a fixed-scale decimal, never a float. */
function money(value: number): string {
  return value.toFixed(2);
}

/** The three columns a Pack Size is stored in, or their absence. */
function packColumns(pack: PackSizeDto | null | undefined) {
  return {
    packQuantity: pack ? pack.quantity.toFixed(3) : null,
    packUnit: pack ? pack.unit : null,
    packByWeight: pack?.byWeight ?? false,
  };
}

/**
 * What a Store has learned one grocery name means, product and all, in one
 * query. A row with no product is a Miss, or a Pending Link while `triedAt`
 * is still empty, and reads as one.
 */
export async function resolveProductLink(
  storeId: string,
  name: string
): Promise<ResolvedProductLink | null> {
  const normalizedName = normalizeGroceryName(name);

  if (!normalizedName) return null;

  const [row] = await db
    .select({ link: storeProductLinks, product: storeProducts })
    .from(storeProductLinks)
    .leftJoin(storeProducts, eq(storeProducts.id, storeProductLinks.storeProductId))
    .where(
      and(
        eq(storeProductLinks.storeId, storeId),
        eq(storeProductLinks.normalizedName, normalizedName)
      )
    )
    .limit(1);

  if (!row) return null;
  const link = StoreProductLinkSelectSchema.safeParse(row.link);

  if (!link.success) throw new Error("Failed to parse product link");

  return {
    storeId: link.data.storeId,
    normalizedName: link.data.normalizedName,
    triedAt: link.data.triedAt,
    product: row.product ? parseProduct(row.product) : null,
  };
}

/**
 * Every Product Link a household's stores hold for a set of grocery names, in
 * one query rather than one per grocery.
 */
export async function resolveProductLinks(
  pairs: { storeId: string; name: string }[]
): Promise<ResolvedProductLink[]> {
  const wanted = new Set(
    pairs
      .map(({ storeId, name }) => ({ storeId, normalized: normalizeGroceryName(name) }))
      .filter((pair) => pair.normalized !== "")
      .map((pair) => productLinkKey(pair.storeId, pair.normalized))
  );

  if (wanted.size === 0) return [];
  const storeIds = [...new Set(pairs.map((pair) => pair.storeId))];
  const names = [...new Set(pairs.map((pair) => normalizeGroceryName(pair.name)).filter(Boolean))];

  const rows = await db
    .select({ link: storeProductLinks, product: storeProducts })
    .from(storeProductLinks)
    .leftJoin(storeProducts, eq(storeProducts.id, storeProductLinks.storeProductId))
    .where(
      and(
        inArray(storeProductLinks.storeId, storeIds),
        inArray(storeProductLinks.normalizedName, names)
      )
    );

  return rows
    .filter((row) => wanted.has(productLinkKey(row.link.storeId, row.link.normalizedName)))
    .map((row) => ({
      storeId: row.link.storeId,
      normalizedName: row.link.normalizedName,
      triedAt: row.link.triedAt,
      product: row.product ? parseProduct(row.product) : null,
    }));
}

/**
 * Point a grocery name at a product, or at nothing. Last writer wins, with no
 * version guard: the last human to choose is right, and a Miss is the same row
 * with no product and a fresh `triedAt`.
 */
export async function upsertProductLink(
  storeId: string,
  name: string,
  storeProductId: string | null
): Promise<void> {
  const normalizedName = normalizeGroceryName(name);

  if (!normalizedName) return;

  await db
    .insert(storeProductLinks)
    .values({ storeId, normalizedName, storeProductId, triedAt: new Date() })
    .onConflictDoUpdate({
      target: [storeProductLinks.storeId, storeProductLinks.normalizedName],
      set: {
        storeProductId,
        triedAt: new Date(),
        updatedAt: new Date(),
        version: sql`${storeProductLinks.version} + 1`,
      },
    });
}

/**
 * What the lookup queue learned about a name, written only where nobody has
 * answered it. The queue reads a shop between two paced visits, and a shopper
 * may choose the product in that gap — through the panel, or from a
 * housemate's screen. A shopper's answer is the answer, so the write itself
 * carries the condition rather than a check made seconds before it: a link
 * that already points at a product is left exactly as it is, Miss or match.
 * Returns whether anything was written.
 */
export async function linkIfUnanswered(
  storeId: string,
  name: string,
  storeProductId: string | null
): Promise<boolean> {
  const normalizedName = normalizeGroceryName(name);

  if (!normalizedName) return false;

  const rows = await db
    .insert(storeProductLinks)
    .values({ storeId, normalizedName, storeProductId, triedAt: new Date() })
    .onConflictDoUpdate({
      target: [storeProductLinks.storeId, storeProductLinks.normalizedName],
      set: {
        storeProductId,
        triedAt: new Date(),
        updatedAt: new Date(),
        version: sql`${storeProductLinks.version} + 1`,
      },
      setWhere: isNull(storeProductLinks.storeProductId),
    })
    .returning({ id: storeProductLinks.id });

  return rows.length > 0;
}

/**
 * The Store has been asked what this name means. A Pending Link is written
 * before the question goes on the queue, because nothing else on the wire
 * says "being asked", and only where nobody has answered: a link or a Miss is
 * left exactly as it is. A Pending Link a dead worker left behind must not
 * stop the question for ever, so one older than `askedBefore` is asked again
 * and stamped so. Returns whether the question is the caller's to enqueue —
 * a fresh Pending Link somebody else wrote is theirs.
 */
export async function markLinkPending(
  storeId: string,
  name: string,
  askedBefore: Date
): Promise<boolean> {
  const normalizedName = normalizeGroceryName(name);

  if (!normalizedName) return false;

  const rows = await db
    .insert(storeProductLinks)
    .values({ storeId, normalizedName, storeProductId: null, triedAt: null })
    .onConflictDoUpdate({
      target: [storeProductLinks.storeId, storeProductLinks.normalizedName],
      set: { updatedAt: new Date(), version: sql`${storeProductLinks.version} + 1` },
      setWhere: and(
        isNull(storeProductLinks.storeProductId),
        isNull(storeProductLinks.triedAt),
        lt(storeProductLinks.updatedAt, askedBefore)
      ),
    })
    .returning({ id: storeProductLinks.id });

  return rows.length > 0;
}

/**
 * A question the shop did not answer. The Pending Link goes, so the name is
 * unknown again and the next view of the list asks. Only a Pending Link: a
 * link or a Miss written in the meantime is an answer, and stays.
 */
export async function clearPendingLink(storeId: string, name: string): Promise<boolean> {
  const normalizedName = normalizeGroceryName(name);

  if (!normalizedName) return false;

  const rows = await db
    .delete(storeProductLinks)
    .where(
      and(
        eq(storeProductLinks.storeId, storeId),
        eq(storeProductLinks.normalizedName, normalizedName),
        isNull(storeProductLinks.storeProductId),
        isNull(storeProductLinks.triedAt)
      )
    )
    .returning({ id: storeProductLinks.id });

  return rows.length > 0;
}

/**
 * A product read from a shop page. The page is what makes it the same product,
 * so a second reading of the same page updates the one row rather than adding
 * another. A by-hand product is never touched here — its owner typed it, and
 * nothing that reads a page overwrites that. The Pack Size is the reading's,
 * unless its owner set one by hand: that is the last word, and the three
 * columns keep it whatever the page says this time.
 *
 * A Sale lasts until the shop presents another price. A reading that states
 * a regular price or deal words writes them; one that states neither but
 * reads the same price the Sale is at keeps them, because a product page may
 * not restate what its results card said and silence about the regular price
 * is not evidence the deal ended; one that reads any other price ends the
 * Sale (ADR-0029).
 */
export async function upsertReadProduct(
  reading: StoreProductReadingInput
): Promise<StoreProductDto> {
  const pack = packColumns(reading.pack);
  const price = money(reading.price);
  const regularPrice = reading.regularPrice == null ? null : money(reading.regularPrice);
  const dealWords = reading.dealWords ?? null;
  const [row] = await db
    .insert(storeProducts)
    .values({
      storeId: reading.storeId,
      name: reading.name,
      pageUrl: reading.pageUrl,
      price,
      currency: reading.currency,
      size: reading.size ?? null,
      ...pack,
      packByHand: false,
      regularPrice,
      dealWords,
      pricedAt: new Date(),
      isManual: false,
    })
    .onConflictDoUpdate({
      target: [storeProducts.storeId, storeProducts.pageUrl],
      set: {
        name: reading.name,
        price,
        currency: reading.currency,
        size: reading.size ?? null,
        packQuantity: sql`case when ${storeProducts.packByHand} then ${storeProducts.packQuantity} else ${pack.packQuantity}::numeric end`,
        packUnit: sql`case when ${storeProducts.packByHand} then ${storeProducts.packUnit} else ${pack.packUnit}::text end`,
        packByWeight: sql`case when ${storeProducts.packByHand} then ${storeProducts.packByWeight} else ${pack.packByWeight}::boolean end`,
        regularPrice: sql`case when ${regularPrice}::numeric is not null then ${regularPrice}::numeric when ${storeProducts.price} = ${price}::numeric then ${storeProducts.regularPrice} else null end`,
        dealWords: sql`case when ${dealWords}::text is not null then ${dealWords}::text when ${storeProducts.price} = ${price}::numeric then ${storeProducts.dealWords} else null end`,
        pricedAt: new Date(),
        updatedAt: new Date(),
        version: sql`${storeProducts.version} + 1`,
      },
      setWhere: eq(storeProducts.isManual, false),
    })
    .returning();

  if (row) return parseProduct(row);

  // The conflicting row is a by-hand product: it keeps what its owner typed.
  const [existing] = await db
    .select()
    .from(storeProducts)
    .where(
      and(eq(storeProducts.storeId, reading.storeId), eq(storeProducts.pageUrl, reading.pageUrl))
    )
    .limit(1);

  if (!existing) throw new Error("Failed to upsert a store product");

  return parseProduct(existing);
}

/**
 * A Store Product someone typed: for a shop Norish cannot read, or one of the
 * shop's own corrected by hand, which keeps the Sale and the pack it had.
 */
export async function createManualProduct(
  input: StoreProductManualCreateInput
): Promise<StoreProductDto> {
  const [row] = await db
    .insert(storeProducts)
    .values({
      id: input.id,
      storeId: input.storeId,
      name: input.name,
      pageUrl: null,
      price: money(input.price),
      currency: input.currency,
      size: input.size ?? null,
      ...packColumns(input.pack),
      packByHand: Boolean(input.pack),
      regularPrice: input.regularPrice == null ? null : money(input.regularPrice),
      dealWords: input.dealWords ?? null,
      pricedAt: new Date(),
      isManual: true,
    })
    .returning();

  if (!row) throw new Error("Failed to create a by-hand store product");

  return parseProduct(row);
}

export async function updateManualProduct(
  input: StoreProductManualUpdateInput
): Promise<StoreProductDto | null> {
  const [row] = await db
    .update(storeProducts)
    .set({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.price === undefined ? {} : { price: money(input.price), pricedAt: new Date() }),
      ...(input.currency === undefined ? {} : { currency: input.currency }),
      ...(input.size === undefined ? {} : { size: input.size ?? null }),
      ...(input.pack === undefined
        ? {}
        : { ...packColumns(input.pack), packByHand: Boolean(input.pack) }),
      ...(input.regularPrice === undefined
        ? {}
        : { regularPrice: input.regularPrice === null ? null : money(input.regularPrice) }),
      ...(input.dealWords === undefined ? {} : { dealWords: input.dealWords ?? null }),
      updatedAt: new Date(),
      version: sql`${storeProducts.version} + 1`,
    })
    .where(and(eq(storeProducts.id, input.id), eq(storeProducts.isManual, true)))
    .returning();

  return row ? parseProduct(row) : null;
}

/**
 * A Pack Size set by hand, which is the last word: no reading, match or
 * refresh replaces it while it stands. Cleared — `null` — the product goes
 * back to what its own size words say, and readings may fill it in again.
 */
export async function setPackSizeByHand(
  id: string,
  pack: PackSizeDto | null
): Promise<StoreProductDto | null> {
  const existing = await getStoreProductById(id);

  if (!existing) return null;
  const columns = pack ? packColumns(pack) : packColumns(readPackSize(existing.size));
  const [row] = await db
    .update(storeProducts)
    .set({
      ...columns,
      packByHand: pack !== null,
      updatedAt: new Date(),
      version: sql`${storeProducts.version} + 1`,
    })
    .where(eq(storeProducts.id, id))
    .returning();

  return row ? parseProduct(row) : null;
}

export async function getStoreProductById(id: string): Promise<StoreProductDto | null> {
  const [row] = await db.select().from(storeProducts).where(eq(storeProducts.id, id)).limit(1);

  return row ? parseProduct(row) : null;
}

/** Everything one Store knows it sells, newest reading first. */
export async function listStoreProducts(storeId: string): Promise<StoreProductDto[]> {
  const rows = await db
    .select()
    .from(storeProducts)
    .where(eq(storeProducts.storeId, storeId))
    .orderBy(storeProducts.name);

  return parseProducts(rows);
}

/**
 * The read products among these whose Shelf Price is older than the ceiling,
 * least recently touched first. A by-hand product is never stale: nothing
 * read it, and nothing may refresh it. "Touched" rather than "priced": a page
 * that could not be re-read is noted as tried (see `noteProductUnreadable`),
 * so a shop's dead pages take their turn behind its live ones instead of
 * filling every refresh with pages that answer nothing.
 */
export async function listStaleProducts(
  productIds: string[],
  olderThan: Date
): Promise<StoreProductDto[]> {
  if (productIds.length === 0) return [];
  const rows = await db
    .select()
    .from(storeProducts)
    .where(
      and(
        inArray(storeProducts.id, productIds),
        eq(storeProducts.isManual, false),
        isNotNull(storeProducts.pageUrl),
        lt(storeProducts.pricedAt, olderThan)
      )
    )
    .orderBy(storeProducts.updatedAt);

  return parseProducts(rows);
}

/**
 * A product page that could not be re-read. The price is kept as it was — a
 * page that is down is not a page that says nothing costs anything — and the
 * attempt is noted, so the next refresh asks about the products it has not
 * tried for longest.
 */
export async function noteProductUnreadable(id: string): Promise<void> {
  await db.update(storeProducts).set({ updatedAt: new Date() }).where(eq(storeProducts.id, id));
}
