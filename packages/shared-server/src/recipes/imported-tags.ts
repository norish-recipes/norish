import { listEntryNames } from "@norish/db/repositories/list-entries";
import { matchNamesToList } from "@norish/shared/lib/list-match";

/** An import's Tags as its household's list spells them: fold, then near-match, else a new Tag (ADR-0043). */
export async function matchImportedTags<T extends { tags?: { name: string }[] }>(
  householdId: string,
  recipe: T
): Promise<T> {
  if (!recipe.tags?.length) return recipe;

  const list = await listEntryNames("tag", householdId);
  const names = matchNamesToList(
    recipe.tags.map((tag) => tag.name),
    list
  );

  return { ...recipe, tags: names.map((name) => ({ name })) };
}
