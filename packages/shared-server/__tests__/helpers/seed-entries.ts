import type { SeedEntry } from "@norish/db/repositories/ingredient-seed";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

/** A seeded food with no parent, named after the first of its spellings. */
export function seedEntry(offId: string, ...names: string[]): SeedEntry {
  return {
    offId,
    name: names[0]!,
    nameFold: ingredientAliasFold(names[0]!),
    parentOffId: null,
    nutrition: null,
    aliases: names.map((text) => ({ text, fold: ingredientAliasFold(text), locale: null })),
  };
}

/** A seeded food with each spelling in its language: `["kaas", "af"]`. */
export function seedEntryIn(offId: string, ...names: Array<[string, string | null]>): SeedEntry {
  return {
    ...seedEntry(offId, names[0]![0]),
    aliases: names.map(([text, locale]) => ({ text, fold: ingredientAliasFold(text), locale })),
  };
}
