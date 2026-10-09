import { and, asc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import z from "zod";

import type { DbTransaction } from "@norish/db/drizzle";
import type { AisleDto, AisleFiled, AisleInput, AisleLinkDto } from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import { aisleLinks, aisles } from "@norish/db/schema";
import { AisleLinkSelectSchema, AisleSelectSchema } from "@norish/shared/contracts/zod";

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

  // An edit made against a version the aisle no longer has is not applied:
  // the first writer won (ADR-0004), and a housemate's rename stands.
  const current = (aisle: { id: string; version: number }) => {
    const next = wanted.get(aisle.id);

    return next !== undefined && (next.version === undefined || next.version === aisle.version);
  };
  // Renames first step aside, so "Zuivel" and "Brood" can change places.
  const renamed = existing.filter((aisle) => {
    const next = wanted.get(aisle.id);

    return next !== undefined && next.name !== aisle.name && current(aisle);
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
          or(ne(aisles.name, aisle.name), ne(aisles.sortOrder, index)),
          ...(aisle.version === undefined ? [] : [eq(aisles.version, aisle.version)])
        ),
      });
  }

  return listAislesByStoreIds([storeId], tx);
}

/**
 * Every Aisle Link of a set of Stores, in one query: one row per Ingredient
 * ever filed at each Store, which is small, and the whole of what a screen
 * needs to show a list by aisle.
 */
export async function listAisleLinksByStoreIds(storeIds: string[]): Promise<AisleLinkDto[]> {
  if (storeIds.length === 0) return [];

  const rows = await db
    .select({
      storeId: aisleLinks.storeId,
      ingredientId: aisleLinks.ingredientId,
      aisleId: aisleLinks.aisleId,
    })
    .from(aisleLinks)
    .where(and(inArray(aisleLinks.storeId, storeIds), isNotNull(aisleLinks.ingredientId)));

  const parsed = AisleLinksSchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse aisle links");

  return parsed.data;
}

/**
 * Where each Store files the foods on a household's list that have no Aisle
 * Link of their own there: in the Aisle of their nearest Parent Ingredient
 * that has one (ADR-0037). One row per Store and food, shaped like an Aisle
 * Link, so a screen reads a grocery's aisle the same way whether the Store
 * learned it for that food or for a food it is a kind of. Only the foods on
 * the list (groceries and recurring groceries, done or not) are answered: a
 * tree seeded from the catalogue has thousands of descendants a household
 * will never buy.
 */
export async function listInheritedAisleLinks(
  storeIds: string[],
  userIds: string[]
): Promise<AisleLinkDto[]> {
  if (storeIds.length === 0 || userIds.length === 0) return [];

  const stores = sql.join(
    storeIds.map((id) => sql`${id}::uuid`),
    sql`, `
  );
  const users = sql.join(
    userIds.map((id) => sql`${id}`),
    sql`, `
  );
  const result = await db.execute<{ storeId: string; ingredientId: string; aisleId: string }>(sql`
    with recursive listed as (
      select ingredient_id from groceries where user_id in (${users}) and ingredient_id is not null
      union
      select ingredient_id from recurring_groceries
        where user_id in (${users}) and ingredient_id is not null
    ),
    up(start, ancestor, depth) as (
      select i.id, i.parent_id, 1 from ingredients i
        join listed l on l.ingredient_id = i.id
        where i.parent_id is not null
      union all
      select up.start, p.parent_id, up.depth + 1 from up
        join ingredients p on p.id = up.ancestor
        where p.parent_id is not null and up.depth < 32
    )
    select distinct on (up.start, l.store_id)
        l.store_id::text as "storeId", up.start::text as "ingredientId", l.aisle_id::text as "aisleId"
      from up
      join aisle_links l on l.ingredient_id = up.ancestor and l.store_id in (${stores})
      where not exists (
        select 1 from aisle_links own
          where own.store_id = l.store_id and own.ingredient_id = up.start
      )
      order by up.start, l.store_id, up.depth`);

  const parsed = AisleLinksSchema.safeParse(result.rows);

  if (!parsed.success) throw new Error("Failed to parse inherited aisle links");

  return parsed.data;
}

/**
 * File an Ingredient at a Store: under one of its aisles, or under none,
 * which forgets it. Filing one spelling files every spelling of the food.
 * Last writer wins, with no version guard: the last shopper to file is right.
 * Returns what the Store now files the Ingredient under.
 */
export async function fileIngredient(
  storeId: string,
  ingredientId: string,
  aisleId: string | null
): Promise<AisleFiled> {
  if (aisleId === null) {
    await db
      .delete(aisleLinks)
      .where(and(eq(aisleLinks.storeId, storeId), eq(aisleLinks.ingredientId, ingredientId)));
  } else {
    await db
      .insert(aisleLinks)
      .values({ storeId, ingredientId, aisleId })
      .onConflictDoUpdate({
        target: [aisleLinks.storeId, aisleLinks.ingredientId],
        set: { aisleId, updatedAt: new Date(), version: sql`${aisleLinks.version} + 1` },
      });
  }

  return { storeId, ingredientId, aisleId };
}
