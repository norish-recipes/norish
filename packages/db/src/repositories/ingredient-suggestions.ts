import { asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DbTransaction } from "@norish/db/drizzle";
import type { SuggestionKind } from "@norish/shared/contracts/ingredient-catalogue";
import { db } from "@norish/db/drizzle";
import { ingredients, ingredientSuggestions } from "@norish/db/schema";

/**
 * What AI proposes for Ingredients, waiting on a person (ADR-0037). AI writes
 * a suggestion instead of an edit; confirming one is the edit a person makes
 * through the catalogue module, and dismissing one deletes it. Nothing here
 * decides who may do either.
 */

/** One suggestion as the page reads it, with the names of both foods and who owns the one it is about. */
export interface StoredIngredientSuggestion {
  id: string;
  ingredientId: string;
  ingredientName: string;
  ingredientOwnerId: string | null;
  kind: SuggestionKind;
  target: { id: string; name: string } | null;
  englishName: string | null;
  considered: string[];
}

/** Record what AI proposes for an Ingredient, replacing what it proposed before. */
export async function upsertIngredientSuggestion(input: {
  ingredientId: string;
  kind: SuggestionKind;
  targetId: string | null;
  englishName: string | null;
  considered: string[];
}): Promise<void> {
  const values = {
    kind: input.kind,
    targetId: input.targetId,
    englishName: input.englishName,
    considered: input.considered,
  };

  await db
    .insert(ingredientSuggestions)
    .values({ ingredientId: input.ingredientId, ...values })
    .onConflictDoUpdate({
      target: ingredientSuggestions.ingredientId,
      set: { ...values, createdAt: new Date() },
    });
}

const targets = alias(ingredients, "suggestion_targets");

function selectSuggestions() {
  return db
    .select({
      id: ingredientSuggestions.id,
      ingredientId: ingredientSuggestions.ingredientId,
      ingredientName: ingredients.name,
      ingredientOwnerId: ingredients.ownerId,
      kind: ingredientSuggestions.kind,
      targetId: targets.id,
      targetName: targets.name,
      englishName: ingredientSuggestions.englishName,
      considered: ingredientSuggestions.considered,
    })
    .from(ingredientSuggestions)
    .innerJoin(ingredients, eq(ingredients.id, ingredientSuggestions.ingredientId))
    .leftJoin(targets, eq(targets.id, ingredientSuggestions.targetId));
}

type SuggestionRow = Awaited<ReturnType<typeof selectSuggestions>>[number];

function stored(row: SuggestionRow): StoredIngredientSuggestion {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    ingredientOwnerId: row.ingredientOwnerId,
    kind: row.kind as SuggestionKind,
    target: row.targetId && row.targetName ? { id: row.targetId, name: row.targetName } : null,
    englishName: row.englishName,
    considered: row.considered,
  };
}

/** Every suggestion waiting on a person, oldest first, so a round reads in the order it was asked. */
export async function listIngredientSuggestions(): Promise<StoredIngredientSuggestion[]> {
  const rows = await selectSuggestions().orderBy(
    asc(ingredientSuggestions.createdAt),
    asc(ingredients.name)
  );

  return rows.map(stored);
}

/** These suggestions, where they are still waiting; one already settled is left out. */
export async function findIngredientSuggestions(
  ids: readonly string[]
): Promise<StoredIngredientSuggestion[]> {
  if (ids.length === 0) return [];
  const rows = await selectSuggestions().where(inArray(ingredientSuggestions.id, [...ids]));

  return rows.map(stored);
}

/** Drop a suggestion: dismissed, or its Ingredient was settled another way. */
export async function deleteIngredientSuggestion(id: string): Promise<void> {
  await db.delete(ingredientSuggestions).where(eq(ingredientSuggestions.id, id));
}

/** Drop whatever AI proposed for an Ingredient: a person has settled it. */
export async function deleteSuggestionFor(
  ingredientId: string,
  tx: typeof db | DbTransaction = db
): Promise<void> {
  await tx
    .delete(ingredientSuggestions)
    .where(eq(ingredientSuggestions.ingredientId, ingredientId));
}
