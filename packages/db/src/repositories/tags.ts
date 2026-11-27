import { db } from "@norish/db/drizzle";
import { normalizeEnrichmentTagNames } from "@norish/shared/lib/recipe-enrichment";

import { appendRecipeEntriesTx } from "./list-entries";

/** Appends Recipe Enrichment's Tags from the recipe's household's list, removing none, so
 * enrichments finish in any order; answers the Tags added and all the recipe's Tags after. */
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
