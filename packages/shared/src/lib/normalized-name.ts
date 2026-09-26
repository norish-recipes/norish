/**
 * The one folding of a name used everywhere a Grocery is matched against what
 * a shop sells: as the key of a Product Link, and as the rule that decides
 * whether a candidate is unmistakably the thing the user asked for. It folds
 * case, diacritics, punctuation and whitespace and nothing else — "Oude Kaas",
 * "oude  kaas" and "Oude kaas!" are one name, "oude kaasjes" is another.
 */
export function normalizeGroceryName(name: string | null | undefined): string {
  if (!name) return "";

  return (
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      // Back together again: NFD takes a Hangul syllable apart too, and nothing
      // above put it back.
      .normalize("NFC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  );
}

/** The words of a normalized name, as the auto-link rule counts them. */
export function nameWords(name: string): string[] {
  return normalizeGroceryName(name)
    .split(" ")
    .filter((word) => word.length > 0);
}
