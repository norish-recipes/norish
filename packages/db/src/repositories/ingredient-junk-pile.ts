import { and, eq, inArray, isNull, ne, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Db } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import { ingredientJunkPile } from "@norish/db/schema";

import { inCatalogue } from "./catalogue-scope";

/**
 * The junk pile (CONTEXT.md): folds of texts that name no food, the seed's and each household's
 * own (ADR-0042). Why one is there: AI deleted its food or a spelling as not a food, a person said
 * so, or the seed lists it. A household's "names-a-food" row is no junk: it lifts the seed's mark of
 * that fold for that household alone, as a person or an Undo said the text names a food.
 */
export type JunkReason = "not-a-food" | "person" | "seed";

/** A household's word that names a food there, whatever the seed's pile says. */
const NAMES_A_FOOD = "names-a-food";

const lifted = alias(ingredientJunkPile, "lifted");

/** Whose marks: a household's, or the seed's (null). */
const marksOf = (householdId: string | null) =>
  householdId === null
    ? isNull(ingredientJunkPile.householdId)
    : eq(ingredientJunkPile.householdId, householdId);

/** The junk of a household's catalogue: its own marks and the seed's it has not lifted. */
export function junkOf(householdId: string) {
  return and(
    inCatalogue(ingredientJunkPile.householdId, householdId),
    ne(ingredientJunkPile.reason, NAMES_A_FOOD),
    notExists(
      db
        .select({ id: lifted.id })
        .from(lifted)
        .where(
          and(
            eq(lifted.householdId, householdId),
            eq(lifted.fold, ingredientJunkPile.fold),
            eq(lifted.reason, NAMES_A_FOOD)
          )
        )
    )
  );
}

/** Every fold on the household's pile and the seed's it has not lifted, for the resolver's rules. */
export async function listJunkFolds(householdId: string, tx: Db = db): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ fold: ingredientJunkPile.fold })
    .from(ingredientJunkPile)
    .where(junkOf(householdId));

  return rows.map((row) => row.fold);
}

/**
 * Put folds on a household's pile (null: the seed's), with the AI Change that put them there where
 * one did; a fold already there keeps its entry. How many were added.
 */
export async function addToJunkPile(
  tx: Db,
  householdId: string | null,
  folds: readonly string[],
  { reason, aiChangeId = null }: { reason: JunkReason; aiChangeId?: string | null }
): Promise<number> {
  const unique = [...new Set(folds.filter((fold) => fold.length > 0))];

  if (unique.length === 0) return 0;
  // A household that marks a fold junk again no longer lifts the seed's mark of it.
  if (householdId !== null) {
    await tx
      .delete(ingredientJunkPile)
      .where(
        and(
          marksOf(householdId),
          eq(ingredientJunkPile.reason, NAMES_A_FOOD),
          inArray(ingredientJunkPile.fold, unique)
        )
      );
  }
  const added = await tx
    .insert(ingredientJunkPile)
    .values(unique.map((fold) => ({ householdId, fold, reason, aiChangeId })))
    .onConflictDoNothing()
    .returning({ id: ingredientJunkPile.id });

  return added.length;
}

/**
 * Take folds off a household's pile (null: the seed's), a person having said they name a food; a
 * household lifts the seed's mark of such a fold for itself. How many marks went or were lifted.
 */
export async function takeOffJunkPile(
  tx: Db,
  householdId: string | null,
  folds: readonly string[]
): Promise<number> {
  if (folds.length === 0) return 0;
  const taken = await tx
    .delete(ingredientJunkPile)
    .where(
      and(
        marksOf(householdId),
        ne(ingredientJunkPile.reason, NAMES_A_FOOD),
        inArray(ingredientJunkPile.fold, [...folds])
      )
    )
    .returning({ id: ingredientJunkPile.id });

  if (householdId === null) return taken.length;
  const seedMarks = await tx
    .select({ fold: ingredientJunkPile.fold })
    .from(ingredientJunkPile)
    .where(
      and(isNull(ingredientJunkPile.householdId), inArray(ingredientJunkPile.fold, [...folds]))
    );

  if (seedMarks.length === 0) return taken.length;
  const lifts = await tx
    .insert(ingredientJunkPile)
    .values(seedMarks.map(({ fold }) => ({ householdId, fold, reason: NAMES_A_FOOD })))
    .onConflictDoNothing()
    .returning({ id: ingredientJunkPile.id });

  return taken.length + lifts.length;
}
