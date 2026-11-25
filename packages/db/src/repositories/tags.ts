import type { DbTransaction } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import { normalizeEnrichmentTagNames } from "@norish/shared/lib/recipe-enrichment";

import {
  appendRecipeEntriesTx,
  listEntryRows,
  recipeEntryNames,
  replaceRecipeEntriesByNameTx,
} from "./list-entries";

/** The household's Tag names (ADR-0043). */
export async function listTagNamesForHousehold(householdId: string): Promise<string[]> {
  return (await listEntryRows("tag", householdId)).map((tag) => tag.name);
}

/** Replaces a recipe's Tags with `tagNames`, from its household's list. */
export async function attachTagsToRecipeByInputTx(
  tx: DbTransaction,
  recipeId: string,
  tagNames: readonly string[]
): Promise<void> {
  await replaceRecipeEntriesByNameTx(tx, "tag", recipeId, tagNames);
}

export function getRecipeTagNames(recipeId: string): Promise<string[]> {
  return recipeEntryNames("tag", recipeId);
}

/**
 * Append Recipe Enrichment findings to a recipe's tags, from its household's list.
 *
 * Inserts only the links that are missing and never deletes an existing one, so
 * supplied tags survive and auto-tagging and allergy detection can finish in any
 * order — or concurrently — without losing each other's findings.
 *
 * @returns the tags this call actually added, and the resulting full tag list
 */
export async function appendRecipeTags(
  recipeId: string,
  incomingTagNames: readonly string[]
): Promise<{ added: string[]; allTags: string[] }> {
  const normalized = normalizeEnrichmentTagNames(incomingTagNames);

  return await db.transaction(async (tx) => {
    const { added, all } = await appendRecipeEntriesTx(tx, "tag", recipeId, normalized);

    return { added, allTags: all };
  });
}
