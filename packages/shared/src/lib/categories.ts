import { foldName } from "./fold-name";

/** The four Categories every household has: fixed, translated, never removed (ADR-0040). */
export const BUILT_IN_CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

export type BuiltInCategory = (typeof BUILT_IN_CATEGORIES)[number];

export function isBuiltInCategory(name: string): name is BuiltInCategory {
  return (BUILT_IN_CATEGORIES as readonly string[]).includes(name);
}

/** A Category name trimmed, inner whitespace collapsed. */
export function cleanCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** A folded name's entry in `table`, or its entry less a plural "s". */
export function lookupFoldedName<T>(
  table: Readonly<Record<string, T>>,
  folded: string
): T | undefined {
  if (Object.hasOwn(table, folded)) return table[folded];

  const stem = folded.endsWith("s") ? folded.slice(0, -1) : "";

  return stem && Object.hasOwn(table, stem) ? table[stem] : undefined;
}

/**
 * The Category a person-given name means: a built-in through `aliases` (folded
 * name or plural), else an existing name ignoring case, else the cleaned name.
 */
export function resolveCategoryName(
  input: string,
  aliases: Readonly<Record<string, BuiltInCategory>>,
  existingNames: readonly string[]
): string {
  const name = cleanCategoryName(input);
  const builtIn = lookupFoldedName(aliases, foldName(name));

  if (builtIn) return builtIn;

  const lower = name.toLowerCase();

  return existingNames.find((existing) => existing.toLowerCase() === lower) ?? name;
}
