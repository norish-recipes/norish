import type { AisleDto } from "../contracts/dto/stores";

/** How two aisle names are compared: a Store cannot hold "Zuivel" and "zuivel" both. */
export function foldAisleName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * The first name in the list that another entry already carries, compared
 * without regard to case, or null where every name is its own. The Store
 * editor refuses it inline and the server refuses it again on Save, and both
 * ask this rather than each their own rule.
 */
export function duplicateAisleName(names: readonly string[]): string | null {
  const seen = new Set<string>();

  for (const name of names) {
    const folded = foldAisleName(name);

    if (folded === "") continue;
    if (seen.has(folded)) return name;
    seen.add(folded);
  }

  return null;
}

/** A Store's aisles in the order the household walks them. */
export function sortAisles<T extends Pick<AisleDto, "sortOrder">>(aisles: readonly T[]): T[] {
  return [...aisles].sort((a, b) => a.sortOrder - b.sortOrder);
}
