import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";
import z from "zod";

import type { DbTransaction } from "@norish/db/drizzle";
import type { AisleDto, AisleFiled, AisleInput, AisleLinkDto } from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import { aisleLinks, aisles } from "@norish/db/schema";
import { AisleLinkSelectSchema, AisleSelectSchema } from "@norish/shared/contracts/zod";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

/** The connection a caller is already inside, or the shared one. */
type Db = typeof db | DbTransaction;

const AislesSchema = z.array(AisleSelectSchema);
const AisleLinksSchema = z.array(AisleLinkSelectSchema);

function parseAisles(rows: unknown[]): AisleDto[] {
  const parsed = AislesSchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse aisles");

  return parsed.data;
}

/**
 * The aisles of a set of Stores, each Store's in its own order. One query for
 * however many Stores, so a Store list is never one aisle query per Store.
 */
export async function listAislesByStoreIds(storeIds: string[], tx: Db = db): Promise<AisleDto[]> {
  if (storeIds.length === 0) return [];

  const rows = await tx
    .select()
    .from(aisles)
    .where(inArray(aisles.storeId, storeIds))
    .orderBy(asc(aisles.storeId), asc(aisles.sortOrder), asc(aisles.createdAt));

  return parseAisles(rows);
}

export async function getAisleById(id: string): Promise<AisleDto | null> {
  const [row] = await db.select().from(aisles).where(eq(aisles.id, id)).limit(1);

  if (!row) return null;
  const parsed = AisleSelectSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to parse aisle");

  return parsed.data;
}

/**
 * A name no aisle a person types can collide with — names are trimmed on the
 * way in, so none starts with a space — so two aisles may swap names in one
 * save without the unique index refusing the half-done state.
 */
function parkedName(id: string): string {
  return ` ${id}`;
}

/**
 * The Store's aisle list becomes exactly the one given, in the order given
 * (ADR-0031): a known id is renamed and repositioned, a new id is created, and
 * an aisle absent from the list is deleted, its Aisle Links going with it by
 * cascade — which is what unfiling is. An id that belongs to another Store is
 * not this Store's to touch, and is left exactly as it is.
 */
export async function saveStoreAisles(
  storeId: string,
  input: AisleInput[],
  tx: Db = db
): Promise<AisleDto[]> {
  const existing = await tx.select().from(aisles).where(eq(aisles.storeId, storeId));
  const wanted = new Map(input.map((aisle) => [aisle.id, aisle] as const));
  const gone = existing.filter((aisle) => !wanted.has(aisle.id)).map((aisle) => aisle.id);

  if (gone.length > 0) {
    await tx.delete(aisles).where(and(eq(aisles.storeId, storeId), inArray(aisles.id, gone)));
  }

  // Renames first step aside, so "Zuivel" and "Brood" can change places.
  const renamed = existing.filter((aisle) => {
    const next = wanted.get(aisle.id);

    return next !== undefined && next.name !== aisle.name;
  });

  for (const aisle of renamed) {
    await tx
      .update(aisles)
      .set({ name: parkedName(aisle.id) })
      .where(and(eq(aisles.id, aisle.id), eq(aisles.storeId, storeId)));
  }

  for (const [index, aisle] of input.entries()) {
    // A known aisle is rewritten only where its name or place changed, so a
    // Store saved for its colour leaves its aisles' versions alone.
    await tx
      .insert(aisles)
      .values({ id: aisle.id, storeId, name: aisle.name, sortOrder: index })
      .onConflictDoUpdate({
        target: aisles.id,
        set: {
          name: aisle.name,
          sortOrder: index,
          updatedAt: new Date(),
          version: sql`${aisles.version} + 1`,
        },
        setWhere: and(
          eq(aisles.storeId, storeId),
          or(ne(aisles.name, aisle.name), ne(aisles.sortOrder, index))
        ),
      });
  }

  return listAislesByStoreIds([storeId], tx);
}

/**
 * Every Aisle Link of a set of Stores, in one query: one row per distinct name
 * ever filed at each Store, which is small, and the whole of what a screen
 * needs to show a list by aisle.
 */
export async function listAisleLinksByStoreIds(storeIds: string[]): Promise<AisleLinkDto[]> {
  if (storeIds.length === 0) return [];

  const rows = await db
    .select({
      storeId: aisleLinks.storeId,
      normalizedName: aisleLinks.normalizedName,
      aisleId: aisleLinks.aisleId,
    })
    .from(aisleLinks)
    .where(inArray(aisleLinks.storeId, storeIds));

  const parsed = AisleLinksSchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse aisle links");

  return parsed.data;
}

/**
 * File a name at a Store: under one of its aisles, or under none, which
 * forgets it. The name is folded here, with the Product Link's folding, so
 * "Melk" and " melk! " are one name. Last writer wins, with no version guard:
 * the last shopper to file is right. Returns what the Store now files the name
 * under, or null where the name folds to nothing and nothing was written.
 */
export async function fileGroceryName(
  storeId: string,
  name: string,
  aisleId: string | null
): Promise<AisleFiled | null> {
  const normalizedName = normalizeGroceryName(name);

  if (!normalizedName) return null;

  if (aisleId === null) {
    await db
      .delete(aisleLinks)
      .where(and(eq(aisleLinks.storeId, storeId), eq(aisleLinks.normalizedName, normalizedName)));
  } else {
    await db
      .insert(aisleLinks)
      .values({ storeId, normalizedName, aisleId })
      .onConflictDoUpdate({
        target: [aisleLinks.storeId, aisleLinks.normalizedName],
        set: { aisleId, updatedAt: new Date(), version: sql`${aisleLinks.version} + 1` },
      });
  }

  return { storeId, normalizedName, aisleId };
}
